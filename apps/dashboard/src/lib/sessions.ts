/**
 * Checkout session logic shared by the /api/v1 routes and the dashboard UI.
 *
 * Exports:
 *  - createCheckoutSessionForMerchant(merchant, input): Promise<SessionResult<CheckoutSession>>
 *      input = { orderId, amount: "49.99", currency?: "USDT", successUrl?, cancelUrl?, metadata? }
 *      Requires merchant.status === "active" and a registered payout (registeredTxHash set).
 *      Idempotent per (merchant, orderId): an open/processing unexpired session with the same amount
 *      is returned as-is (created: false). An already paid order yields a conflict.
 *  - getPublicCheckoutSession(id): Promise<PublicCheckoutSession | null>   (lazily marks expired)
 *  - getCheckoutSessionForMerchant(merchantId, id): Promise<CheckoutSession | null>
 *  - getSessionStatus(id): Promise<status | null>
 *  - submitSessionTx(id, txHash): Promise<SessionResult<{ status }>>  stores the hint, open -> processing.
 *      Does NOT validate; the route triggers validateTx() from "@/lib/indexer" afterwards.
 *
 * SessionResult is `{ ok: true, value, created? } | { ok: false, status, type, message }` so callers can
 * map failures straight onto apiError(status, type, message) or show `message` in the UI.
 */
import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { chainOrderId, fromUnits, toUnits } from "@whitechain-commerce/core";
import type { CheckoutSession, PublicCheckoutSession } from "@whitechain-commerce/core";
import { db, checkoutSessions, merchants, payments } from "./db";
import type { Merchant } from "./auth";
import { usdtDecimals } from "./chain";
import { newId } from "./ids";
import { toCheckoutSession, toPublicSession } from "./serializers";

export const SESSION_TTL_MS = 30 * 60 * 1000;

export type ErrorType = "invalid_request" | "authentication" | "not_found" | "conflict" | "server_error";
export type SessionFailure = { ok: false; status: number; type: ErrorType; message: string };
export type SessionResult<T> = { ok: true; value: T; created?: boolean } | SessionFailure;

export interface CreateSessionInput {
  orderId: string;
  amount: string; // decimal string, e.g. "49.99"
  currency?: "USDT";
  successUrl?: string | null;
  cancelUrl?: string | null;
  metadata?: Record<string, string> | null;
}

const fail = (status: number, type: ErrorType, message: string): SessionFailure => ({ ok: false, status, type, message });

export async function createCheckoutSessionForMerchant(
  merchant: Merchant,
  input: CreateSessionInput,
): Promise<SessionResult<CheckoutSession>> {
  if (merchant.status !== "active") {
    return fail(409, "conflict", "Merchant account is not active yet. Complete verification in the dashboard.");
  }
  if (!merchant.payoutAddress || !merchant.registeredTxHash) {
    return fail(409, "conflict", "No payout address registered. Set your payout wallet in the dashboard before creating checkout sessions.");
  }
  if (input.currency && input.currency !== "USDT") return fail(400, "invalid_request", "Only USDT is supported.");

  const decimals = await usdtDecimals();
  let units: bigint;
  try {
    units = toUnits(input.amount, decimals);
  } catch (e) {
    return fail(400, "invalid_request", `Invalid amount: ${(e as Error).message}`);
  }

  // Serialize concurrent/retried creates for the same (merchant, orderId) so only one payable session exists.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${merchant.id}:${input.orderId}`}, 0))`);
    const existing = await tx
      .select({ s: checkoutSessions, p: payments })
      .from(checkoutSessions)
      .leftJoin(payments, eq(payments.sessionId, checkoutSessions.id))
      .where(and(eq(checkoutSessions.merchantId, merchant.id), eq(checkoutSessions.orderId, input.orderId)))
      .orderBy(desc(checkoutSessions.createdAt));

    if (existing.some((r) => r.p || r.s.status === "paid")) {
      return fail(409, "conflict", `Order ${input.orderId} has already been paid.`);
    }
    const now = Date.now();
    const sameAmount = existing.find(
      (r) =>
        r.s.amountUnits === units.toString() &&
        (r.s.status === "processing" || (r.s.status === "open" && r.s.expiresAt.getTime() > now)),
    );
    if (sameAmount) return { ok: true as const, value: toCheckoutSession(sameAmount.s, merchant, null), created: false };
    if (existing.some((r) => r.s.status === "processing")) {
      return fail(409, "conflict", `A payment for order ${input.orderId} is already being processed.`);
    }

    const id = newId("cs");
    const [row] = await tx
      .insert(checkoutSessions)
      .values({
        id,
        merchantId: merchant.id,
        orderId: input.orderId,
        chainOrderId: chainOrderId(id),
        amount: fromUnits(units, decimals), // normalized, e.g. "5" -> "5.00"
        amountUnits: units.toString(),
        decimals,
        currency: "USDT",
        status: "open",
        successUrl: input.successUrl ?? null,
        cancelUrl: input.cancelUrl ?? null,
        metadata: input.metadata ?? null,
        expiresAt: new Date(now + SESSION_TTL_MS),
      })
      .returning();
    return { ok: true as const, value: toCheckoutSession(row, merchant, null), created: true };
  });
}

type SessionRow = typeof checkoutSessions.$inferSelect;

/** Marks an open session expired if its time is up. Never touches processing/paid sessions. */
async function lazyExpire(s: SessionRow): Promise<SessionRow> {
  if (s.status !== "open" || s.expiresAt.getTime() > Date.now()) return s;
  const [u] = await db
    .update(checkoutSessions)
    .set({ status: "expired" })
    .where(and(eq(checkoutSessions.id, s.id), eq(checkoutSessions.status, "open"), lt(checkoutSessions.expiresAt, new Date())))
    .returning();
  if (u) return u;
  const [fresh] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, s.id));
  return fresh ?? s;
}

async function loadSession(id: string, merchantId?: string) {
  const conds = [eq(checkoutSessions.id, id)];
  if (merchantId) conds.push(eq(checkoutSessions.merchantId, merchantId));
  const [row] = await db
    .select({ s: checkoutSessions, m: merchants, p: payments })
    .from(checkoutSessions)
    .innerJoin(merchants, eq(merchants.id, checkoutSessions.merchantId))
    .leftJoin(payments, eq(payments.sessionId, checkoutSessions.id))
    .where(and(...conds))
    .limit(1);
  if (!row) return null;
  const s = row.p ? row.s : await lazyExpire(row.s);
  return { s, m: row.m, p: row.p };
}

export async function getPublicCheckoutSession(id: string): Promise<PublicCheckoutSession | null> {
  const r = await loadSession(id);
  return r ? toPublicSession(r.s, r.m, r.p) : null;
}

export async function getCheckoutSessionForMerchant(merchantId: string, id: string): Promise<CheckoutSession | null> {
  const r = await loadSession(id, merchantId);
  return r ? toCheckoutSession(r.s, r.m, r.p) : null;
}

/** Stores the widget-reported tx hash (a hint only) and moves open -> processing. */
export async function submitSessionTx(
  id: string,
  txHash: `0x${string}`,
): Promise<SessionResult<{ status: SessionRow["status"] }>> {
  const [s] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
  if (!s) return fail(404, "not_found", `No checkout session ${id}.`);
  if (s.status === "paid") return { ok: true, value: { status: "paid" } };
  const [u] = await db
    .update(checkoutSessions)
    .set({ submittedTxHash: txHash.toLowerCase() })
    .where(eq(checkoutSessions.id, id))
    .returning();
  // open -> processing (expired sessions keep their status; the indexer still validates the hint)
  const [p] = await db
    .update(checkoutSessions)
    .set({ status: "processing" })
    .where(and(eq(checkoutSessions.id, id), inArray(checkoutSessions.status, ["open"])))
    .returning();
  return { ok: true, value: { status: (p ?? u).status } };
}

export async function getSessionStatus(id: string): Promise<SessionRow["status"] | null> {
  const [s] = await db.select({ status: checkoutSessions.status }).from(checkoutSessions).where(eq(checkoutSessions.id, id)).limit(1);
  return s?.status ?? null;
}
