/**
 * End-to-end test of webhook delivery against a local HTTP receiver.
 *   cd apps/dashboard && pnpm exec tsx --env-file=../../.env scripts/test-webhooks.ts
 */
import "../src/lib/indexer/node-shim";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import assert from "node:assert/strict";

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const { verifyWebhook } = await import("@whitechain-commerce/core/webhooks");
  const { chainMerchantId } = await import("@whitechain-commerce/core");
  const { db, merchants, webhookEndpoints, webhookEvents, webhookDeliveries, webhookAttempts } = await import("@/lib/db");
  const { newId } = await import("@/lib/ids");
  const { enqueueEvent, deliverDue, redeliver, sendTestEvent, USER_AGENT } = await import("@/lib/webhooks");
  const { eq, inArray, asc } = await import("drizzle-orm");

  const secret = `whsec_${newId("we").slice(3)}`;
  const received: { id: string; type: string; ua: string | undefined }[] = [];
  const failures: string[] = [];

  const server = createServer(async (req, res) => {
    const body = await readBody(req);
    if (req.url === "/fail") {
      res.writeHead(500).end("nope");
      return;
    }
    try {
      const evt = verifyWebhook(body, req.headers["wc-signature"] as string, secret);
      // Tampered body must not verify.
      assert.throws(() => verifyWebhook(body + " ", req.headers["wc-signature"] as string, secret));
      received.push({ id: evt.id, type: evt.type, ua: req.headers["user-agent"] });
      res.writeHead(200, { "content-type": "text/plain" }).end("x".repeat(3000));
    } catch (e) {
      failures.push(String(e));
      res.writeHead(400).end("bad signature");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const merchantId = newId("mer");
  const okEp = newId("we");
  const failEp = newId("we");
  const offEp = newId("we");
  const eventIds: string[] = [];

  try {
    await db.insert(merchants).values({
      id: merchantId,
      email: `${merchantId}@test.local`,
      passwordHash: "x",
      name: "Webhook Test",
      status: "active",
      chainMerchantId: chainMerchantId(merchantId),
    });
    await db.insert(webhookEndpoints).values([
      { id: okEp, merchantId, url: `${base}/ok`, secret },
      { id: failEp, merchantId, url: `${base}/fail`, secret },
      { id: offEp, merchantId, url: `${base}/ok`, secret, enabled: false },
    ]);

    const payment = {
      id: "pay_test", sessionId: "cs_test", orderId: "order_1", amount: "1.5", amountRefunded: "0",
      currency: "USDT" as const, status: "succeeded" as const,
      payer: "0x000000000000000000000000000000000000dEaD" as const,
      txHash: `0x${"ab".repeat(32)}` as `0x${string}`, explorerUrl: "", chainId: 1874 as const,
      chainPaymentId: `0x${"cd".repeat(32)}` as `0x${string}`, createdAt: new Date().toISOString(),
    };
    const { eventId, deliveries } = await enqueueEvent(db, merchantId, "payment.succeeded", { payment });
    eventIds.push(eventId);
    assert.equal(deliveries, 2, "one delivery per ENABLED endpoint");

    const [evRow] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, eventId));
    const p = evRow.payload as { id: string; type: string; created: number; data: unknown };
    assert.equal(p.id, eventId);
    assert.equal(typeof p.created, "number");

    const dels = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.eventId, eventId));
    const okDel = dels.find((d) => d.endpointId === okEp)!;
    const failDel = dels.find((d) => d.endpointId === failEp)!;

    // Two concurrent passes must not double send.
    await Promise.all([deliverDue(), deliverDue()]);
    assert.equal(received.filter((r) => r.id === eventId).length, 1, "delivered exactly once despite 2 workers");
    assert.equal(failures.length, 0, `signature failures: ${failures.join(", ")}`);
    assert.equal(received[0].ua, USER_AGENT);
    assert.equal(received[0].type, "payment.succeeded");

    const get = async (id: string) => (await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, id)))[0];
    const okAfter = await get(okDel.id);
    assert.equal(okAfter.status, "succeeded");
    assert.equal(okAfter.lastStatusCode, 200);
    const [okAttempt] = await db.select().from(webhookAttempts).where(eq(webhookAttempts.deliveryId, okDel.id));
    assert.ok(okAttempt.responseBody!.length <= 1024, "response body truncated to 1KB");

    // Retry schedule for the failing endpoint: +1m, +5m, +30m, then failed.
    const expectDelays = [60, 300, 1800];
    for (let i = 1; i <= 4; i++) {
      if (i > 1) await db.update(webhookDeliveries).set({ nextAttemptAt: new Date(Date.now() - 1000) }).where(eq(webhookDeliveries.id, failDel.id));
      const before = Date.now();
      // Not due yet => must not be sent (checked by attempts count before forcing the next one).
      await deliverDue();
      const d = await get(failDel.id);
      assert.equal(d.attempts, i, `attempt ${i} recorded`);
      assert.equal(d.lastStatusCode, 500);
      if (i < 4) {
        assert.equal(d.status, "pending");
        const delay = (d.nextAttemptAt.getTime() - before) / 1000;
        assert.ok(Math.abs(delay - expectDelays[i - 1]) < 5, `attempt ${i}: next in ${delay}s, expected ${expectDelays[i - 1]}s`);
        await deliverDue(); // not due: no extra attempt
        assert.equal((await get(failDel.id)).attempts, i, "not resent before nextAttemptAt");
      } else {
        assert.equal(d.status, "failed", "failed after 4th attempt");
      }
    }
    const failAttempts = await db.select().from(webhookAttempts).where(eq(webhookAttempts.deliveryId, failDel.id)).orderBy(asc(webhookAttempts.attempt));
    assert.deepEqual(failAttempts.map((a) => a.attempt), [1, 2, 3, 4]);
    assert.ok(failAttempts.every((a) => a.statusCode === 500 && a.responseBody === "nope"));

    // Manual redeliver of the succeeded delivery sends it again (receivers dedupe on id).
    const re = await redeliver(okDel.id, merchantId);
    assert.equal(re.ok, true);
    assert.equal(received.filter((r) => r.id === eventId).length, 2);
    await assert.rejects(() => redeliver(okDel.id, "mer_someoneelse"));

    // Test event.
    const t = await sendTestEvent(okEp, merchantId);
    eventIds.push(t.eventId);
    assert.equal(t.ok, true);
    assert.ok(received.some((r) => r.id === t.eventId));
    await assert.rejects(() => sendTestEvent(okEp, "mer_someoneelse"));

    console.log("PASS test-webhooks:", {
      received: received.length,
      okStatus: okAfter.status,
      failAttempts: failAttempts.length,
    });
  } finally {
    server.close();
    const allEvents = (await db.select({ id: webhookEvents.id }).from(webhookEvents).where(eq(webhookEvents.merchantId, merchantId))).map((e) => e.id);
    if (allEvents.length) {
      await db.delete(webhookDeliveries).where(inArray(webhookDeliveries.eventId, allEvents)); // attempts cascade
      await db.delete(webhookEvents).where(inArray(webhookEvents.id, allEvents));
    }
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.merchantId, merchantId));
    await db.delete(merchants).where(eq(merchants.id, merchantId));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL test-webhooks:", e);
    process.exit(1);
  });
