/**
 * Smoke test for /api/v1 route handlers, no dev server needed.
 * Run from apps/dashboard:
 *   pnpm exec tsx --conditions=react-server --env-file=../../.env scripts/smoke-api.ts
 * (--conditions=react-server makes the "server-only" marker import a no-op outside Next.)
 * Inserts two throwaway merchants + API keys, calls the handlers with Request objects, asserts, cleans up.
 */
import { eq, inArray } from "drizzle-orm";
import { chainMerchantId, chainPaymentId } from "@whitechain-commerce/core";
import { db, apiKeys, checkoutSessions, merchants, payments, refunds } from "../src/lib/db";
import { newId, randomId, sha256 } from "../src/lib/ids";

import * as sessionsRoute from "../src/app/api/v1/checkout_sessions/route";
import * as sessionRoute from "../src/app/api/v1/checkout_sessions/[id]/route";
import * as submitRoute from "../src/app/api/v1/checkout_sessions/[id]/submit/route";
import * as paymentsRoute from "../src/app/api/v1/payments/route";
import * as paymentRoute from "../src/app/api/v1/payments/[id]/route";
import * as refundsRoute from "../src/app/api/v1/refunds/route";

const BASE = "http://localhost:3000/api/v1";
let failures = 0;
let passes = 0;

function check(cond: boolean, label: string, extra?: unknown) {
  if (cond) {
    passes++;
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
function req(path: string, init: { method?: string; key?: string; body?: unknown; rawBody?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.key) headers.authorization = `Bearer ${init.key}`;
  return new Request(`${BASE}${path}`, {
    method: init.method ?? (init.body !== undefined || init.rawBody !== undefined ? "POST" : "GET"),
    headers,
    body: init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
  });
}
async function call(p: Promise<Response>) {
  const res = await p;
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test script inspects arbitrary JSON
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

async function makeMerchant(registered: boolean) {
  const id = newId("mer");
  await db.insert(merchants).values({
    id,
    email: `smoke+${randomId(8)}@example.test`,
    passwordHash: "x:y",
    name: `Smoke ${registered ? "Registered" : "Unregistered"}`,
    status: "active",
    payoutAddress: registered ? "0x000000000000000000000000000000000000dEaD" : null,
    chainMerchantId: chainMerchantId(id),
    registeredTxHash: registered ? `0x${"ab".repeat(32)}` : null,
  });
  const key = `sk_test_${randomId(32)}`;
  await db.insert(apiKeys).values({ id: newId("key"), merchantId: id, prefix: key.slice(0, 12), keyHash: sha256(key) });
  return { id, key };
}

async function main() {
  const A = await makeMerchant(true);
  const B = await makeMerchant(false);
  const merchantIds = [A.id, B.id];
  const orderId = `order_${randomId(8)}`;

  try {
    console.log("CORS / auth / validation");
    const pre = await sessionsRoute.OPTIONS();
    check(pre.status === 204 && pre.headers.get("access-control-allow-origin") === "*", "OPTIONS preflight 204 + CORS");
    for (const r of [sessionRoute, submitRoute, paymentsRoute, paymentRoute, refundsRoute]) {
      check((await r.OPTIONS()).status === 204, "OPTIONS on every v1 route");
    }
    let r = await call(sessionsRoute.POST(req("/checkout_sessions", { body: { orderId, amount: "1" } })));
    check(r.status === 401 && r.body?.error?.type === "authentication", "create without key -> 401", r);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: "sk_test_nope", body: { orderId, amount: "1" } })));
    check(r.status === 401, "create with bad key -> 401", r);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, rawBody: "{not json" })));
    check(r.status === 400 && r.body?.error?.type === "invalid_request", "invalid JSON -> 400", r);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "-5" } })));
    check(r.status === 400, "negative amount -> 400", r);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "1.1234567" } })));
    check(r.status === 400, "too many decimals -> 400", r);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "0" } })));
    check(r.status === 400, "zero amount -> 400", r);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "1", currency: "ETH" } })));
    check(r.status === 400, "non-USDT currency -> 400", r);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: B.key, body: { orderId, amount: "1" } })));
    check(r.status === 409 && /payout/i.test(r.body?.error?.message ?? ""), "unregistered payout -> 409", r);

    console.log("create / idempotency");
    r = await call(
      sessionsRoute.POST(
        req("/checkout_sessions", {
          key: A.key,
          body: { orderId, amount: "49.99", successUrl: "https://shop.test/ok", metadata: { cart: "42" } },
        }),
      ),
    );
    check(r.status === 201, "create -> 201", r);
    check(r.headers.get("access-control-allow-origin") === "*", "create response has CORS");
    const cs = r.body;
    check(cs?.id?.startsWith("cs_") && cs.amountUnits === "49990000" && cs.decimals === 6, "units at 6 decimals", cs);
    check(typeof cs?.url === "string" && cs.url.endsWith(`/checkout/${cs.id}`), "hosted url present");
    check(cs?.metadata?.cart === "42" && cs?.status === "open", "metadata + open status");
    const ttl = new Date(cs.expiresAt).getTime() - Date.now();
    check(ttl > 29 * 60_000 && ttl <= 30 * 60_000 + 1000, "expires in ~30 min");

    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "49.99" } })));
    check(r.status === 200 && r.body?.id === cs.id, "same order+amount returns existing session", r.body?.id);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "10" } })));
    check(r.status === 201 && r.body?.id !== cs.id, "same order, different amount -> new session");
    const cs2 = r.body;

    console.log("public GET / lazy expiry");
    r = await call(sessionRoute.GET(req(`/checkout_sessions/${cs.id}`), ctx(cs.id)));
    check(r.status === 200 && r.body?.merchant?.name === "Smoke Registered" && r.body?.url === undefined, "public GET 200, no secret fields", r);
    check(r.body?.metadata === undefined, "public GET hides metadata");
    r = await call(sessionRoute.GET(req(`/checkout_sessions/cs_missing`), ctx("cs_missing")));
    check(r.status === 404 && r.body?.error?.type === "not_found", "unknown session -> 404", r);
    await db.update(checkoutSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(checkoutSessions.id, cs2.id));
    r = await call(sessionRoute.GET(req(`/checkout_sessions/${cs2.id}`), ctx(cs2.id)));
    check(r.body?.status === "expired", "past-expiry open session -> expired", r.body?.status);

    console.log("submit");
    r = await call(submitRoute.POST(req(`/checkout_sessions/${cs.id}/submit`, { body: { txHash: "0x1234" } }), ctx(cs.id)));
    check(r.status === 400, "bad tx hash -> 400", r);
    r = await call(
      submitRoute.POST(req(`/checkout_sessions/cs_missing/submit`, { body: { txHash: `0x${"11".repeat(32)}` } }), ctx("cs_missing")),
    );
    check(r.status === 404, "submit unknown session -> 404", r);
    const fakeTx = `0x${"cd".repeat(32)}`;
    const t0 = Date.now();
    r = await call(submitRoute.POST(req(`/checkout_sessions/${cs.id}/submit`, { body: { txHash: fakeTx } }), ctx(cs.id)));
    check(r.status === 200 && r.body?.ok === true && r.body?.status === "processing", "submit -> ok, processing (not paid)", r);
    console.log(`       (submit took ${Date.now() - t0} ms incl. validateTx attempt)`);
    const [afterSubmit] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, cs.id));
    check(afterSubmit.submittedTxHash === fakeTx && afterSubmit.status !== "paid", "hint stored, never marked paid");
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "49.99" } })));
    check(r.status === 200 && r.body?.id === cs.id, "processing session is returned for same order+amount", r.body?.id);
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "5" } })));
    check(r.status === 409, "different amount while processing -> 409", r);

    console.log("payments (fake settled payment inserted directly)");
    const payId = newId("pay");
    await db.insert(payments).values({
      id: payId,
      sessionId: cs.id,
      merchantId: A.id,
      chainPaymentId: chainPaymentId(chainMerchantId(A.id), cs.chainOrderId),
      payer: "0x1111111111111111111111111111111111111111",
      payout: "0x000000000000000000000000000000000000dEaD",
      amountUnits: "49990000",
      decimals: 6,
      txHash: `0x${randomId(8).toLowerCase().padEnd(64, "0")}`,
      blockNumber: 1n,
      logIndex: 0,
    });
    await db.update(checkoutSessions).set({ status: "paid" }).where(eq(checkoutSessions.id, cs.id));

    r = await call(paymentsRoute.GET(req("/payments")));
    check(r.status === 401, "payments without key -> 401");
    r = await call(paymentsRoute.GET(req("/payments?limit=500", { key: A.key })));
    check(r.status === 400, "limit > 100 -> 400", r);
    r = await call(paymentsRoute.GET(req("/payments?limit=10", { key: A.key })));
    check(r.status === 200 && r.body?.data?.length === 1 && r.body.data[0].id === payId, "list payments", r.body);
    check(r.body?.data?.[0]?.amount === "49.99" && r.body.data[0].orderId === orderId, "payment object amount/orderId");
    r = await call(paymentsRoute.GET(req("/payments", { key: B.key })));
    check(r.status === 200 && r.body?.data?.length === 0, "other merchant sees no payments");
    r = await call(paymentRoute.GET(req(`/payments/${payId}`, { key: A.key }), ctx(payId)));
    check(r.status === 200 && r.body?.id === payId, "get payment", r);
    r = await call(paymentRoute.GET(req(`/payments/${payId}`, { key: B.key }), ctx(payId)));
    check(r.status === 404, "other merchant's payment -> 404", r);
    r = await call(sessionRoute.GET(req(`/checkout_sessions/${cs.id}`), ctx(cs.id)));
    check(r.body?.status === "paid" && r.body?.payment?.id === payId, "public session shows payment");
    r = await call(sessionsRoute.POST(req("/checkout_sessions", { key: A.key, body: { orderId, amount: "49.99" } })));
    check(r.status === 409 && /already been paid/.test(r.body?.error?.message ?? ""), "paid order -> 409", r);
    r = await call(submitRoute.POST(req(`/checkout_sessions/${cs.id}/submit`, { body: { txHash: fakeTx } }), ctx(cs.id)));
    check(r.status === 200 && r.body?.status === "paid", "submit on paid session -> paid", r);

    console.log("refunds");
    r = await call(refundsRoute.POST(req("/refunds", { body: { paymentId: payId, amount: "1" } })));
    check(r.status === 401, "refund without key -> 401");
    r = await call(refundsRoute.POST(req("/refunds", { key: B.key, body: { paymentId: payId, amount: "1" } })));
    check(r.status === 404, "refund other merchant's payment -> 404", r);
    r = await call(refundsRoute.POST(req("/refunds", { key: A.key, body: { paymentId: payId, amount: "50" } })));
    check(r.status === 400 && /exceeds/.test(r.body?.error?.message ?? ""), "over-refund -> 400", r);
    r = await call(refundsRoute.POST(req("/refunds", { key: A.key, body: { paymentId: payId, amount: "abc" } })));
    check(r.status === 400, "bad refund amount -> 400", r);
    r = await call(refundsRoute.POST(req("/refunds", { key: A.key, body: { paymentId: payId, amount: "20" } })));
    check(r.status === 201 && r.body?.status === "pending" && r.body?.amount === "20.00" && r.body?.id?.startsWith("re_"), "partial refund -> 201 pending", r);
    r = await call(refundsRoute.POST(req("/refunds", { key: A.key, body: { paymentId: payId, amount: "30" } })));
    check(r.status === 400, "pending refunds count against balance (20 + 30 > 49.99)", r);
    // concurrent requests must not over-allocate (row lock)
    const conc = await Promise.all(
      [1, 2, 3].map(() => call(refundsRoute.POST(req("/refunds", { key: A.key, body: { paymentId: payId, amount: "15" } })))),
    );
    check(conc.filter((c) => c.status === 201).length === 1, "concurrent refunds: only one of three 15s fits", conc.map((c) => c.status));
    r = await call(refundsRoute.POST(req("/refunds", { key: A.key, body: { paymentId: payId, amount: "14.99" } })));
    check(r.status === 201, "exact remaining balance -> 201", r);
    r = await call(refundsRoute.GET(req(`/refunds?paymentId=${payId}`, { key: A.key })));
    check(r.status === 200 && r.body?.data?.length === 3, "list refunds by payment", r.body?.data?.length);
    r = await call(refundsRoute.GET(req(`/refunds?paymentId=${payId}`, { key: B.key })));
    check(r.status === 200 && r.body?.data?.length === 0, "other merchant sees no refunds");
  } finally {
    const sessionIds = (await db.select({ id: checkoutSessions.id }).from(checkoutSessions).where(inArray(checkoutSessions.merchantId, merchantIds))).map((s) => s.id);
    await db.delete(refunds).where(inArray(refunds.merchantId, merchantIds));
    await db.delete(payments).where(inArray(payments.merchantId, merchantIds));
    if (sessionIds.length) await db.delete(checkoutSessions).where(inArray(checkoutSessions.id, sessionIds));
    await db.delete(merchants).where(inArray(merchants.id, merchantIds)); // cascades api_keys
    void apiKeys;
  }

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
