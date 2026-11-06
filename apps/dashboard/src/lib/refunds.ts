/**
 * Refund logic shared by the /api/v1 routes and the dashboard UI.
 *
 * Exports:
 *  - createPendingRefund(merchantId, { paymentId, amount: "10.5" }): Promise<RefundResult<RefundObject>>
 *      Creates a `pending` refund row. The merchant still has to sign `refund()` from the payout wallet
 *      (non-custodial); the indexer flips the row to `succeeded` when the Refunded event lands.
 *      amount must be <= paid - refunded (onchain) - sum(other pending refunds). Locks the payment
 *      row (SELECT ... FOR UPDATE) so concurrent requests cannot over-allocate.
 *  - listRefunds(merchantId, { paymentId?, limit? }): Promise<RefundObject[]>   newest first
 *  - refundableUnits(paymentId): Promise<bigint>   remaining amount that can still be requested
 *
 * RefundResult is `{ ok: true, value } | { ok: false, status, type, message }` (same shape as sessions.ts).
 */
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { fromUnits, toUnits } from "@whitechain-commerce/core";
import type { RefundObject } from "@whitechain-commerce/core/webhooks";
import { db, checkoutSessions, payments, refunds } from "./db";
import { newId } from "./ids";
import { toRefundObject } from "./serializers";
import type { SessionFailure } from "./sessions";

export type RefundResult<T> = { ok: true; value: T } | SessionFailure;

const fail = (status: number, type: SessionFailure["type"], message: string): SessionFailure => ({ ok: false, status, type, message });

type DbLike = Pick<typeof db, "select">;

async function pendingUnits(q: DbLike, paymentId: string): Promise<bigint> {
  const rows = await q
    .select({ u: refunds.amountUnits })
    .from(refunds)
    .where(and(eq(refunds.paymentId, paymentId), eq(refunds.status, "pending")));
  return rows.reduce((a, r) => a + BigInt(r.u), 0n);
}

export async function refundableUnits(paymentId: string): Promise<bigint> {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p) return 0n;
  const left = BigInt(p.amountUnits) - BigInt(p.refundedUnits) - (await pendingUnits(db, paymentId));
  return left > 0n ? left : 0n;
}

export async function createPendingRefund(
  merchantId: string,
  input: { paymentId: string; amount: string },
): Promise<RefundResult<RefundObject>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ p: payments, s: checkoutSessions })
      .from(payments)
      .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
      .where(and(eq(payments.id, input.paymentId), eq(payments.merchantId, merchantId)))
      .limit(1)
      .for("update", { of: payments });
    if (!row) return fail(404, "not_found", `No payment ${input.paymentId}.`);
    const { p, s } = row;

    let units: bigint;
    try {
      units = toUnits(input.amount, p.decimals);
    } catch (e) {
      return fail(400, "invalid_request", `Invalid amount: ${(e as Error).message}`);
    }

    const available = BigInt(p.amountUnits) - BigInt(p.refundedUnits) - (await pendingUnits(tx, p.id));
    if (units > available) {
      return fail(
        400,
        "invalid_request",
        `Refund amount exceeds the refundable balance (${fromUnits(available > 0n ? available : 0n, p.decimals)} USDT available after refunds and pending refunds).`,
      );
    }

    const [r] = await tx
      .insert(refunds)
      .values({ id: newId("re"), paymentId: p.id, merchantId, amountUnits: units.toString(), status: "pending" })
      .returning();
    return { ok: true as const, value: toRefundObject(r, p, s) };
  });
}

export async function listRefunds(
  merchantId: string,
  opts: { paymentId?: string; limit?: number } = {},
): Promise<RefundObject[]> {
  const conds = [eq(refunds.merchantId, merchantId)];
  if (opts.paymentId) conds.push(eq(refunds.paymentId, opts.paymentId));
  const rows = await db
    .select({ r: refunds, p: payments, s: checkoutSessions })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
    .where(and(...conds))
    .orderBy(desc(refunds.createdAt))
    .limit(Math.min(Math.max(opts.limit ?? 100, 1), 100));
  return rows.map(({ r, p, s }) => toRefundObject(r, p, s));
}

/** Deletes a pending refund that was never signed. Returns its payment id, or null if it can't be discarded. */
export async function discardPendingRefund(merchantId: string, refundId: string): Promise<string | null> {
  const rows = await db
    .delete(refunds)
    .where(and(eq(refunds.id, refundId), eq(refunds.merchantId, merchantId), eq(refunds.status, "pending"), isNull(refunds.txHash)))
    .returning({ paymentId: refunds.paymentId });
  return rows[0]?.paymentId ?? null;
}
