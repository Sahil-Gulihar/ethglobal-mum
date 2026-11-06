/** Run: pnpm --filter @whitechain-commerce/react test */
import { test } from "node:test";
import assert from "node:assert/strict";
import { signWebhook as signWebhookForTest } from "@whitechain-commerce/core/webhooks";
import { createCheckoutSession, verifyWebhook, WhitechainApiError } from "./server";

const base = { apiBase: "http://api.test", secretKey: "sk_test_x", orderId: "o1", amount: "49.99" };

test("createCheckoutSession posts JSON with bearer auth", async (t) => {
  let seen: { url: string; init: RequestInit } | null = null;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ id: "cs_1", url: "http://api.test/checkout/cs_1" }), { status: 201 });
  });
  const s = await createCheckoutSession({ ...base, apiBase: "http://api.test/", metadata: { a: "b" } });
  assert.equal(s.id, "cs_1");
  assert.equal(seen!.url, "http://api.test/api/v1/checkout_sessions");
  assert.equal((seen!.init.headers as Record<string, string>).Authorization, "Bearer sk_test_x");
  assert.deepEqual(JSON.parse(seen!.init.body as string), {
    orderId: "o1",
    amount: "49.99",
    currency: "USDT",
    metadata: { a: "b" },
  });
});

test("API errors surface type, status and message", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ error: { type: "conflict", message: "Register a payout wallet first" } }), {
      status: 409,
    }),
  );
  await assert.rejects(createCheckoutSession(base), (e: unknown) => {
    assert.ok(e instanceof WhitechainApiError);
    assert.equal(e.status, 409);
    assert.equal(e.type, "conflict");
    assert.equal(e.message, "Register a payout wallet first");
    return true;
  });
});

test("network failures and bad input give readable errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });
  await assert.rejects(createCheckoutSession(base), /Could not reach Whitechain Commerce/);
  await assert.rejects(createCheckoutSession({ ...base, amount: "49.9999999" }), /at most 6 decimals/);
  await assert.rejects(createCheckoutSession({ ...base, secretKey: "pk_x" }), /sk_/);
});

test("verifyWebhook is re-exported and works", () => {
  const body = JSON.stringify({ id: "evt_1", type: "payment.succeeded", created: 1, data: {} });
  const now = Math.floor(Date.now() / 1000);
  const evt = verifyWebhook<{ id: string }>(body, signWebhookForTest("whsec", body, now), "whsec");
  assert.equal(evt.id, "evt_1");
  assert.throws(() => verifyWebhook(body, signWebhookForTest("other", body, now), "whsec"), /mismatch/);
});
