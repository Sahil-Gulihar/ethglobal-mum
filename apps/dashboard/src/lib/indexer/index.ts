import "server-only";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getAbiItem, parseEventLogs, TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex, type Log, type TransactionReceipt } from "viem";
import {
  chainPaymentId,
  getRouterAddress,
  paymentRouterAbi,
  PAYMENT_ROUTER_DEPLOY_BLOCK,
  USDT_ADDRESS,
  WHITECHAIN_SEPOLIA_ID,
} from "@whitechain-commerce/core";
import { checkoutSessions, db, indexerState, merchants, payments, refunds } from "@/lib/db";
import { publicClient, usdtDecimals } from "@/lib/chain";
import { newId } from "@/lib/ids";
import { toPaymentObject, toRefundObject } from "@/lib/serializers";
import { enqueueEvent } from "@/lib/webhooks";

const STATE_KEY = process.env.INDEXER_STATE_KEY || "payment_router"; // override only for tests
const CHUNK = 2000n;
const CONFIRMATIONS = 1n;
/** Max chunks per pass so one tick stays bounded while catching up. */
const MAX_CHUNKS_PER_RUN = 10;
const EXPIRY_GRACE_MS = 10 * 60_000;

const paymentSettledEvent = getAbiItem({ abi: paymentRouterAbi, name: "PaymentSettled" });
const refundedEvent = getAbiItem({ abi: paymentRouterAbi, name: "Refunded" });

type RouterLog = ReturnType<typeof parseEventLogs<typeof paymentRouterAbi, true, "PaymentSettled" | "Refunded">>[number];
type SettledLog = Extract<RouterLog, { eventName: "PaymentSettled" }>;
type RefundedLog = Extract<RouterLog, { eventName: "Refunded" }>;

export type HandleResult =
  | { ok: true; kind: "payment" | "refund"; id: string; created: boolean }
  | { ok: false; kind: "payment" | "refund"; reason: string };

const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();
const log = (...a: unknown[]) => console.log("[indexer]", ...a);
const warn = (...a: unknown[]) => console.warn("[indexer]", ...a);

let warnedZero = false;
let chainIdCache: number | null = null;
async function chainId(): Promise<number> {
  if (chainIdCache === null) chainIdCache = await publicClient().getChainId();
  return chainIdCache;
}

/** Per-run caches so one pass doesn't refetch the same receipt/block. */
class Ctx {
  receipts = new Map<string, Promise<TransactionReceipt>>();
  blockTs = new Map<bigint, Promise<bigint>>();
  client = publicClient();
  receipt(hash: Hex) {
    const k = lc(hash);
    if (!this.receipts.has(k)) this.receipts.set(k, this.client.getTransactionReceipt({ hash }));
    return this.receipts.get(k)!;
  }
  timestamp(blockNumber: bigint) {
    if (!this.blockTs.has(blockNumber))
      this.blockTs.set(blockNumber, this.client.getBlock({ blockNumber }).then((b) => b.timestamp));
    return this.blockTs.get(blockNumber)!;
  }
}

// ---------------------------------------------------------------------------------------------
// PaymentSettled
// ---------------------------------------------------------------------------------------------

async function handleSettled(ev: SettledLog, ctx: Ctx): Promise<HandleResult> {
  const fail = (reason: string): HandleResult => {
    warn(`skip PaymentSettled tx=${ev.transactionHash} log=${ev.logIndex}: ${reason}`);
    return { ok: false, kind: "payment", reason };
  };
  const { paymentId, merchantId, orderId, payer, payout, token, amount } = ev.args;
  const router = getRouterAddress();

  if ((await chainId()) !== WHITECHAIN_SEPOLIA_ID) return fail(`wrong chain id ${chainIdCache}`);
  if (lc(ev.address) !== lc(router)) return fail(`log from ${ev.address}, not the router`);
  if (lc(token) !== lc(USDT_ADDRESS)) return fail(`token ${token} is not USDT`);
  if (lc(paymentId) !== lc(chainPaymentId(merchantId, orderId))) return fail("paymentId does not match merchantId/orderId");

  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.chainOrderId, lc(orderId)));
  if (!session) return fail(`no session for orderId ${orderId}`);
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, session.merchantId));
  if (!merchant) return fail(`merchant ${session.merchantId} missing`);
  if (lc(merchant.chainMerchantId) !== lc(merchantId)) return fail(`merchantId mismatch for session ${session.id}`);

  // Already recorded (e.g. by validateTx)? Then nothing to do.
  const [existing] = await db.select({ id: payments.id }).from(payments).where(eq(payments.sessionId, session.id));
  if (existing) return { ok: true, kind: "payment", id: existing.id, created: false };

  if (amount !== BigInt(session.amountUnits)) {
    // The router allows one payment per (merchant, order), so this order id is now used up onchain.
    // Expire the session so the merchant API issues a fresh one instead of returning an unpayable session.
    const burned = await db
      .update(checkoutSessions)
      .set({ status: "expired" })
      .where(and(eq(checkoutSessions.id, session.id), inArray(checkoutSessions.status, ["open", "processing"])))
      .returning({ id: checkoutSessions.id });
    if (burned.length) warn(`session ${session.id} expired: its order id was used by a wrong-amount payment`);
    return fail(`amount ${amount} != session ${session.id} amountUnits ${session.amountUnits}`);
  }
  const decimals = await usdtDecimals();
  if (session.decimals !== decimals) return fail(`session priced with ${session.decimals} decimals, token has ${decimals}`);
  const receipt = await ctx.receipt(ev.transactionHash);
  if (receipt.status !== "success") return fail("tx receipt status is not success");
  // No check of `payout` against merchants.payoutAddress: the verified router paid whatever payout was
  // registered onchain at pay time. Comparing with the current DB value would drop real payments made
  // before a payout change (e.g. while the worker was behind).

  const ts = await ctx.timestamp(ev.blockNumber);
  const paidAt = new Date(Number(ts) * 1000);
  if (paidAt.getTime() > session.expiresAt.getTime() + EXPIRY_GRACE_MS) {
    warn(
      `LATE payment for session ${session.id}: block time ${paidAt.toISOString()} > expiry ${session.expiresAt.toISOString()} + 10m grace. Recording it anyway (funds moved).`,
    );
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(payments)
      .values({
        id: newId("pay"),
        sessionId: session.id,
        merchantId: merchant.id,
        chainPaymentId: lc(paymentId),
        payer: payer,
        payout: payout,
        amountUnits: amount.toString(),
        decimals,
        txHash: lc(ev.transactionHash),
        blockNumber: ev.blockNumber,
        logIndex: ev.logIndex,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      const [p] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.chainPaymentId, lc(paymentId)));
      if (!p) warn(`payment insert conflicted but no row for ${paymentId} (tx hash reused?)`);
      return p
        ? { ok: true as const, kind: "payment" as const, id: p.id, created: false }
        : { ok: false as const, kind: "payment" as const, reason: "insert conflict" };
    }
    const [updated] = await tx
      .update(checkoutSessions)
      .set({ status: "paid" })
      .where(eq(checkoutSessions.id, session.id))
      .returning();
    await enqueueEvent(tx, merchant.id, "payment.succeeded", { payment: toPaymentObject(row, updated) });
    log(`payment ${row.id} session=${session.id} amount=${amount} tx=${ev.transactionHash}`);
    return { ok: true as const, kind: "payment" as const, id: row.id, created: true };
  });
}

// ---------------------------------------------------------------------------------------------
// Refunded
// ---------------------------------------------------------------------------------------------

async function handleRefunded(ev: RefundedLog, ctx: Ctx): Promise<HandleResult> {
  const fail = (reason: string): HandleResult => {
    warn(`skip Refunded tx=${ev.transactionHash} log=${ev.logIndex}: ${reason}`);
    return { ok: false, kind: "refund", reason };
  };
  const { paymentId, amount, totalRefunded } = ev.args;
  if ((await chainId()) !== WHITECHAIN_SEPOLIA_ID) return fail(`wrong chain id ${chainIdCache}`);
  if (lc(ev.address) !== lc(getRouterAddress())) return fail(`log from ${ev.address}, not the router`);

  const [pay0] = await db.select({ id: payments.id }).from(payments).where(eq(payments.chainPaymentId, lc(paymentId)));
  if (!pay0) return fail(`no payment for chainPaymentId ${paymentId}`);
  const receipt = await ctx.receipt(ev.transactionHash);
  if (receipt.status !== "success") return fail("tx receipt status is not success");

  const txHash = lc(ev.transactionHash);
  return db.transaction(async (tx) => {
    // Lock the payment so concurrent handlers of the same refund serialize here.
    const [payment] = await tx.select().from(payments).where(eq(payments.id, pay0.id)).for("update");
    const [dupe] = await tx
      .select({ id: refunds.id })
      .from(refunds)
      .where(and(eq(refunds.txHash, txHash), eq(refunds.logIndex, ev.logIndex)));
    if (dupe) return { ok: true as const, kind: "refund" as const, id: dupe.id, created: false };

    const [pending] = await tx
      .select()
      .from(refunds)
      .where(
        and(eq(refunds.paymentId, payment.id), eq(refunds.status, "pending"), eq(refunds.amountUnits, amount.toString())),
      )
      .orderBy(asc(refunds.createdAt))
      .limit(1)
      .for("update");

    let refund;
    if (pending) {
      [refund] = await tx
        .update(refunds)
        .set({ status: "succeeded", txHash, blockNumber: ev.blockNumber, logIndex: ev.logIndex })
        .where(eq(refunds.id, pending.id))
        .returning();
    } else {
      [refund] = await tx
        .insert(refunds)
        .values({
          id: newId("re"),
          paymentId: payment.id,
          merchantId: payment.merchantId,
          amountUnits: amount.toString(),
          status: "succeeded",
          txHash,
          blockNumber: ev.blockNumber,
          logIndex: ev.logIndex,
        })
        .onConflictDoNothing()
        .returning();
      if (!refund) return { ok: true as const, kind: "refund" as const, id: "", created: false };
    }

    // totalRefunded comes from the contract; never move it backwards if events arrive out of order.
    const prev = BigInt(payment.refundedUnits);
    const total = totalRefunded > prev ? totalRefunded : prev;
    const status = total >= BigInt(payment.amountUnits) ? "refunded" : total > 0n ? "partially_refunded" : "succeeded";
    const [updatedPayment] = await tx
      .update(payments)
      .set({ refundedUnits: total.toString(), status })
      .where(eq(payments.id, payment.id))
      .returning();
    const [session] = await tx.select().from(checkoutSessions).where(eq(checkoutSessions.id, payment.sessionId));

    await enqueueEvent(tx, payment.merchantId, "refund.succeeded", {
      refund: toRefundObject(refund, updatedPayment, session),
      payment: toPaymentObject(updatedPayment, session),
    });
    log(`refund ${refund.id} payment=${payment.id} amount=${amount} total=${total} ${pending ? "(matched request)" : "(new)"}`);
    return { ok: true as const, kind: "refund" as const, id: refund.id, created: true };
  });
}

async function handle(ev: RouterLog, ctx: Ctx): Promise<HandleResult> {
  return ev.eventName === "PaymentSettled" ? handleSettled(ev, ctx) : handleRefunded(ev, ctx);
}

// ---------------------------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------------------------

async function loadCursor(latest: bigint): Promise<bigint> {
  const [row] = await db.select().from(indexerState).where(eq(indexerState.key, STATE_KEY));
  if (row) return row.lastBlock;
  const start =
    PAYMENT_ROUTER_DEPLOY_BLOCK > 0n
      ? PAYMENT_ROUTER_DEPLOY_BLOCK - 1n
      : latest > 5000n
        ? latest - 5000n
        : 0n;
  await db.insert(indexerState).values({ key: STATE_KEY, lastBlock: start }).onConflictDoNothing();
  const [again] = await db.select().from(indexerState).where(eq(indexerState.key, STATE_KEY));
  return again.lastBlock;
}

/**
 * One indexer pass: scans router logs (PaymentSettled, Refunded) from lastBlock+1 to latest-1,
 * in chunks of <= 2000 blocks, validates and records them, then advances indexer_state.
 * Idempotent and safe to run concurrently with validateTx (unique constraints + ON CONFLICT).
 */
export async function runIndexerOnce(): Promise<{ fromBlock: string; toBlock: string; processed: number }> {
  const ctx = new Ctx();
  const router = getRouterAddress();
  const latest = await ctx.client.getBlockNumber();
  const safeHead = latest - CONFIRMATIONS;
  if (/^0x0{40}$/i.test(router)) {
    // Don't advance the shared cursor past blocks a real router might later be deployed in.
    if (!warnedZero) warn("PaymentRouter address is the zero address; set PAYMENT_ROUTER_ADDRESS. Skipping.");
    warnedZero = true;
    return { fromBlock: safeHead.toString(), toBlock: safeHead.toString(), processed: 0 };
  }
  let last = await loadCursor(latest);
  // Jump straight to the deploy block if the cursor is behind it.
  if (PAYMENT_ROUTER_DEPLOY_BLOCK > 0n && last < PAYMENT_ROUTER_DEPLOY_BLOCK - 1n) last = PAYMENT_ROUTER_DEPLOY_BLOCK - 1n;
  const fromBlock = last + 1n;
  let processed = 0;
  let cursor = last;

  for (let i = 0; i < MAX_CHUNKS_PER_RUN && cursor < safeHead; i++) {
    const from = cursor + 1n;
    const to = from + CHUNK - 1n < safeHead ? from + CHUNK - 1n : safeHead;
    const raw = await ctx.client.getLogs({ address: router, events: [paymentSettledEvent, refundedEvent], fromBlock: from, toBlock: to });
    const evs = parseEventLogs({ abi: paymentRouterAbi, logs: raw as Log[], eventName: ["PaymentSettled", "Refunded"] })
      .filter((e) => lc(e.address) === lc(router))
      .sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : a.blockNumber < b.blockNumber ? -1 : 1));
    for (const ev of evs) {
      // A transient RPC/DB error throws and aborts the pass before the cursor moves, so the chunk is retried.
      await handle(ev, ctx);
      processed++;
    }
    await db
      .update(indexerState)
      .set({ lastBlock: to, updatedAt: new Date() })
      .where(and(eq(indexerState.key, STATE_KEY), sql`${indexerState.lastBlock} < ${to}`));
    cursor = to;
  }

  await sweepProcessing(ctx).catch((e) => warn("sweep failed:", e instanceof Error ? e.message : e));
  return { fromBlock: fromBlock.toString(), toBlock: cursor.toString(), processed };
}

export type ValidateResult =
  | { ok: true; results: HandleResult[] }
  | { ok: false; reason: "pending" | "reverted" | "no_router_events" | "invalid"; results?: HandleResult[] };

/**
 * Validates a specific tx right away (used by POST /checkout_sessions/:id/submit).
 * Never trusts the hint: runs exactly the same checks as the indexer on the tx's router logs.
 */
export async function validateTx(txHash: string, ctx = new Ctx(), confirmWaitMs = 8000): Promise<ValidateResult> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, reason: "invalid" };
  let receipt: TransactionReceipt;
  try {
    receipt = await ctx.receipt(txHash as Hex);
  } catch (e) {
    ctx.receipts.delete(lc(txHash));
    if (e instanceof TransactionReceiptNotFoundError || (e instanceof Error && e.name === "TransactionReceiptNotFoundError"))
      return { ok: false, reason: "pending" };
    throw e;
  }
  if (receipt.status !== "success") return { ok: false, reason: "reverted" };
  // Same confirmation depth as the getLogs pass: don't act on a tx in the head block (reorg risk).
  if (!(await waitForConfirmations(ctx, receipt.blockNumber, confirmWaitMs))) return { ok: false, reason: "pending" };
  const router = lc(getRouterAddress());
  const evs = parseEventLogs({
    abi: paymentRouterAbi,
    logs: receipt.logs.filter((l) => lc(l.address) === router),
    eventName: ["PaymentSettled", "Refunded"],
  }).sort((a, b) => a.logIndex - b.logIndex);
  if (!evs.length) return { ok: false, reason: "no_router_events" };
  const results: HandleResult[] = [];
  for (const ev of evs) results.push(await handle(ev, ctx));
  return results.every((r) => r.ok) ? { ok: true, results } : { ok: false, reason: "invalid", results };
}

/** Waits up to `maxMs` for `blockNumber` to have CONFIRMATIONS blocks on top of it. */
async function waitForConfirmations(ctx: Ctx, blockNumber: bigint, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const head = await ctx.client.getBlockNumber({ cacheTime: 0 });
    if (blockNumber <= head - CONFIRMATIONS) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** True if the node knows the tx (mined or in its mempool). Errors count as known, to stay conservative. */
async function txKnown(ctx: Ctx, hash: Hex): Promise<boolean> {
  try {
    await ctx.client.getTransaction({ hash });
    return true;
  } catch (e) {
    return !(e instanceof TransactionNotFoundError || (e instanceof Error && e.name === "TransactionNotFoundError"));
  }
}

/**
 * Sessions left in `processing` by /submit whose hinted tx turned out to be reverted or invalid go
 * back to `open` (or `expired`), so the buyer can retry. Valid payments are picked up by getLogs anyway.
 */
async function sweepProcessing(ctx: Ctx) {
  const rows = await db
    .select({ id: checkoutSessions.id, txHash: checkoutSessions.submittedTxHash, expiresAt: checkoutSessions.expiresAt })
    .from(checkoutSessions)
    .where(and(eq(checkoutSessions.status, "processing"), isNotNull(checkoutSessions.submittedTxHash)))
    .limit(20);
  for (const s of rows) {
    const r = await validateTx(s.txHash!, ctx, 0);
    const expired = Date.now() > s.expiresAt.getTime() + EXPIRY_GRACE_MS;
    // Mined but didn't pay THIS session (reverted, invalid, or someone else's tx): release it.
    // If it did pay this session, the status is already `paid` and the guarded update is a no-op.
    let next: "open" | "expired" | null = null;
    if (r.ok || r.reason !== "pending") next = expired ? "expired" : "open";
    else if (expired) next = "expired"; // hinted tx never landed
    else if (!(await txKnown(ctx, s.txHash as Hex))) next = "open"; // not mined and unknown to the node: bogus hint
    // Releasing to `open` is always safe: a real payment is still picked up by getLogs and marks it paid.
    if (next) {
      const res = await db
        .update(checkoutSessions)
        .set({ status: next })
        .where(and(eq(checkoutSessions.id, s.id), eq(checkoutSessions.status, "processing")))
        .returning({ id: checkoutSessions.id });
      if (res.length) log(`session ${s.id} processing -> ${next} (tx ${s.txHash}: ${r.ok ? "ok" : r.reason})`);
    }
  }
}
