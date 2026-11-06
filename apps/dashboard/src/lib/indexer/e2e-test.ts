/**
 * Indexer end-to-end test on an anvil FORK of Whitechain Sepolia (chain id 1874, real USDT).
 * Deploys a mock router that emits the frozen PaymentSettled/Refunded events, then checks every
 * settlement rule, idempotency under concurrency (validateTx || runIndexerOnce) and refund matching.
 *
 *   cd apps/dashboard && PATH=$HOME/.foundry/bin:$PATH pnpm exec tsx --env-file=../../.env src/lib/indexer/e2e-test.ts
 *
 * Uses its own indexer_state key and cleans up all rows it creates.
 */
import "./node-shim";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const PORT = 8546;
const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const; // anvil default #0

const MOCK = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract MockRouter {
  event PaymentSettled(bytes32 indexed paymentId, bytes32 indexed merchantId, bytes32 indexed orderId, address payer, address payout, address token, uint256 amount);
  event Refunded(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint256 totalRefunded);
  function settle(bytes32 p, bytes32 m, bytes32 o, address payout, address token, uint256 amount) external {
    emit PaymentSettled(p, m, o, msg.sender, payout, token, amount);
  }
  function refund(bytes32 p, address payer, uint256 amount, uint256 total) external { emit Refunded(p, payer, amount, total); }
}
`;
const mockAbi = [
  {
    type: "function", name: "settle", stateMutability: "nonpayable", outputs: [],
    inputs: [
      { name: "p", type: "bytes32" }, { name: "m", type: "bytes32" }, { name: "o", type: "bytes32" },
      { name: "payout", type: "address" }, { name: "token", type: "address" }, { name: "amount", type: "uint256" },
    ],
  },
  {
    type: "function", name: "refund", stateMutability: "nonpayable", outputs: [],
    inputs: [{ name: "p", type: "bytes32" }, { name: "payer", type: "address" }, { name: "amount", type: "uint256" }, { name: "total", type: "uint256" }],
  },
] as const;

async function main() {
  const forkUrl = process.env.WHITECHAIN_RPC_URL!;
  // Compile mock.
  const dir = mkdtempSync(join(tmpdir(), "wc-mock-"));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/Mock.sol"), MOCK);
  execFileSync("forge", ["build", "--root", dir, "--quiet"], { stdio: "inherit" });
  const bytecode = JSON.parse(readFileSync(join(dir, "out/Mock.sol/MockRouter.json"), "utf8")).bytecode.object as `0x${string}`;

  const anvil = spawn("anvil", ["--fork-url", forkUrl, "--port", String(PORT), "--silent"], { stdio: "ignore" });
  const rpc = `http://127.0.0.1:${PORT}`;
  process.env.WHITECHAIN_RPC_URL = rpc;
  process.env.INDEXER_STATE_KEY = `e2e_${Date.now()}`;

  const { createPublicClient, createWalletClient, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");
  const core = await import("@whitechain-commerce/core");
  const { whitechainSepolia, USDT_ADDRESS, chainMerchantId, chainOrderId, chainPaymentId } = core;
  const pub = createPublicClient({ chain: whitechainSepolia, transport: http(rpc) });
  for (let i = 0; ; i++) {
    try { await pub.getBlockNumber(); break; } catch { if (i > 60) throw new Error("anvil did not start"); await new Promise((r) => setTimeout(r, 500)); }
  }
  assert.equal(await pub.getChainId(), 1874, "fork keeps chain id 1874");
  const account = privateKeyToAccount(ANVIL_KEY);
  const wallet = createWalletClient({ chain: whitechainSepolia, transport: http(rpc), account });
  const deployHash = await wallet.deployContract({ abi: mockAbi, bytecode });
  const router = (await pub.waitForTransactionReceipt({ hash: deployHash })).contractAddress!;
  process.env.PAYMENT_ROUTER_ADDRESS = router;

  const { db, merchants, checkoutSessions, payments, refunds, webhookEvents, webhookDeliveries, webhookEndpoints, indexerState } = await import("@/lib/db");
  const { newId } = await import("@/lib/ids");
  const { runIndexerOnce, validateTx } = await import("@/lib/indexer");
  const { eq, inArray } = await import("drizzle-orm");

  const payout = "0x1111111111111111111111111111111111111111" as const;
  const merchantId = newId("mer");
  const mid = chainMerchantId(merchantId);
  const sessionIds: string[] = [];

  const mkSession = async (amountUnits: bigint, opts: { decimals?: number; expiresInMs?: number } = {}) => {
    const id = newId("cs");
    sessionIds.push(id);
    await db.insert(checkoutSessions).values({
      id, merchantId, orderId: `order_${id}`, chainOrderId: chainOrderId(id), amount: "x",
      amountUnits: amountUnits.toString(), decimals: opts.decimals ?? 6, status: "processing",
      expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 30 * 60_000)),
    });
    return { id, oid: chainOrderId(id), pid: chainPaymentId(mid, chainOrderId(id)) };
  };
  const send = async (fn: "settle" | "refund", args: readonly unknown[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hash = await wallet.writeContract({ address: router, abi: mockAbi, functionName: fn, args: args as any });
    await pub.waitForTransactionReceipt({ hash });
    return hash;
  };
  const sessionStatus = async (id: string) => (await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)))[0].status;
  const paymentFor = async (id: string) => (await db.select().from(payments).where(eq(payments.sessionId, id)))[0];

  try {
    await db.insert(merchants).values({
      id: merchantId, email: `${merchantId}@test.local`, passwordHash: "x", name: "Indexer Test",
      status: "active", chainMerchantId: mid, payoutAddress: payout,
    });
    await db.insert(webhookEndpoints).values({ id: newId("we"), merchantId, url: "http://127.0.0.1:9/never", secret: "whsec_x" });

    // 1. Valid payment via validateTx racing runIndexerOnce: exactly one payment row + one event.
    const good = await mkSession(49_990_000n);
    const h1 = await send("settle", [good.pid, mid, good.oid, payout, USDT_ADDRESS, 49_990_000n]);
    const vPending = await validateTx(`0x${"00".repeat(32)}`);
    assert.deepEqual(vPending, { ok: false, reason: "pending" });
    await pub.request({ method: "anvil_mine" as never, params: ["0x1"] as never }); // 1 confirmation for getLogs
    const [v1, , v1b] = await Promise.all([validateTx(h1), runIndexerOnce(), validateTx(h1)]);
    assert.equal(v1.ok, true, JSON.stringify(v1));
    assert.equal(v1b.ok, true);
    assert.equal(await sessionStatus(good.id), "paid");
    const p1 = await paymentFor(good.id);
    assert.equal(p1.amountUnits, "49990000");
    assert.equal(p1.txHash, h1.toLowerCase());
    const evs1 = await db.select().from(webhookEvents).where(eq(webhookEvents.merchantId, merchantId));
    assert.equal(evs1.length, 1, "payment.succeeded enqueued once");
    assert.equal(evs1[0].type, "payment.succeeded");
    assert.equal((evs1[0].payload as { data: { payment: { id: string } } }).data.payment.id, p1.id);
    assert.equal((await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.eventId, evs1[0].id))).length, 1);

    // 2. Rejections: wrong amount, wrong token, wrong payout, wrong merchant, wrong decimals.
    const cases: { name: string; s: Awaited<ReturnType<typeof mkSession>>; args: (s: Awaited<ReturnType<typeof mkSession>>) => readonly unknown[] }[] = [];
    cases.push({ name: "amount", s: await mkSession(1_000_000n), args: (s) => [s.pid, mid, s.oid, payout, USDT_ADDRESS, 999_999n] });
    cases.push({ name: "token", s: await mkSession(1_000_000n), args: (s) => [s.pid, mid, s.oid, payout, router, 1_000_000n] });
    cases.push({ name: "payout", s: await mkSession(1_000_000n), args: (s) => [s.pid, mid, s.oid, account.address, USDT_ADDRESS, 1_000_000n] });
    const otherMid = chainMerchantId("mer_other");
    cases.push({ name: "merchant", s: await mkSession(1_000_000n), args: (s) => [chainPaymentId(otherMid, s.oid), otherMid, s.oid, payout, USDT_ADDRESS, 1_000_000n] });
    cases.push({ name: "paymentId", s: await mkSession(1_000_000n), args: (s) => [`0x${"ee".repeat(32)}`, mid, s.oid, payout, USDT_ADDRESS, 1_000_000n] });
    cases.push({ name: "decimals", s: await mkSession(1_000_000n, { decimals: 18 }), args: (s) => [s.pid, mid, s.oid, payout, USDT_ADDRESS, 1_000_000n] });
    for (const c of cases) {
      const h = await send("settle", c.args(c.s));
      const v = await validateTx(h);
      assert.equal(v.ok, false, `${c.name} must be rejected`);
      assert.equal(await paymentFor(c.s.id), undefined, `${c.name}: no payment row`);
    }

    // 3. Late payment (expired 1h ago): still recorded.
    const late = await mkSession(2_000_000n, { expiresInMs: -60 * 60_000 });
    const hl = await send("settle", [late.pid, mid, late.oid, payout, USDT_ADDRESS, 2_000_000n]);
    assert.equal((await validateTx(hl)).ok, true);
    assert.equal(await sessionStatus(late.id), "paid");

    // 4. Refunds: one matched to a pending API request, one dashboard-initiated (new row).
    const reqRefund = newId("re");
    await db.insert(refunds).values({ id: reqRefund, paymentId: p1.id, merchantId, amountUnits: "10000000" });
    const hr1 = await send("refund", [good.pid, account.address, 10_000_000n, 10_000_000n]);
    await pub.request({ method: "anvil_mine" as never, params: ["0x1"] as never });
    const [r1] = await Promise.all([validateTx(hr1), runIndexerOnce(), validateTx(hr1)]);
    assert.equal(r1.ok, true, JSON.stringify(r1));
    const rr = (await db.select().from(refunds).where(eq(refunds.id, reqRefund)))[0];
    assert.equal(rr.status, "succeeded");
    assert.equal(rr.txHash, hr1.toLowerCase());
    let pp = await paymentFor(good.id);
    assert.equal(pp.status, "partially_refunded");
    assert.equal(pp.refundedUnits, "10000000");

    const hr2 = await send("refund", [good.pid, account.address, 39_990_000n, 49_990_000n]);
    assert.equal((await validateTx(hr2)).ok, true);
    pp = await paymentFor(good.id);
    assert.equal(pp.status, "refunded");
    assert.equal(pp.refundedUnits, "49990000");
    const allRefunds = await db.select().from(refunds).where(eq(refunds.paymentId, p1.id));
    assert.equal(allRefunds.length, 2, "no duplicate refund rows");
    assert.ok(allRefunds.every((r) => r.status === "succeeded"));

    // 5. Full indexer rescan is a no-op (idempotent), and the sweep released rejected sessions.
    await pub.request({ method: "anvil_mine" as never, params: ["0x1"] as never });
    await runIndexerOnce();
    const evTypes = (await db.select().from(webhookEvents).where(eq(webhookEvents.merchantId, merchantId))).map((e) => e.type).sort();
    assert.deepEqual(evTypes, ["payment.succeeded", "payment.succeeded", "refund.succeeded", "refund.succeeded"]);
    for (const c of cases) assert.equal(await sessionStatus(c.s.id), "processing", `${c.name}: stays unpaid (no submitted tx hint)`);

    // 6. Sweep: a processing session whose hinted tx is invalid goes back to open.
    const hinted = await mkSession(5_000_000n);
    const hb = await send("settle", [hinted.pid, mid, hinted.oid, payout, USDT_ADDRESS, 4n]);
    await db.update(checkoutSessions).set({ submittedTxHash: hb }).where(eq(checkoutSessions.id, hinted.id));
    await pub.request({ method: "anvil_mine" as never, params: ["0x1"] as never });
    await runIndexerOnce();
    assert.equal(await sessionStatus(hinted.id), "open");

    console.log("PASS indexer e2e");
  } finally {
    const evIds = (await db.select({ id: webhookEvents.id }).from(webhookEvents).where(eq(webhookEvents.merchantId, merchantId))).map((e) => e.id);
    if (evIds.length) {
      await db.delete(webhookDeliveries).where(inArray(webhookDeliveries.eventId, evIds));
      await db.delete(webhookEvents).where(inArray(webhookEvents.id, evIds));
    }
    await db.delete(refunds).where(eq(refunds.merchantId, merchantId));
    await db.delete(payments).where(eq(payments.merchantId, merchantId));
    await db.delete(checkoutSessions).where(eq(checkoutSessions.merchantId, merchantId));
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.merchantId, merchantId));
    await db.delete(merchants).where(eq(merchants.id, merchantId));
    await db.delete(indexerState).where(eq(indexerState.key, process.env.INDEXER_STATE_KEY!));
    anvil.kill();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL indexer e2e:", e);
    process.exit(1);
  });
