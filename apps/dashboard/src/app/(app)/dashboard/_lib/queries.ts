import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { fromUnits } from "@whitechain-commerce/core";
import { apiKeys, checkoutSessions, db, payments, webhookEndpoints } from "@/lib/db";
import type { Merchant } from "@/lib/auth";

export type PaymentListItem = {
  id: string;
  orderId: string;
  amount: string;
  refunded: string;
  status: "succeeded" | "partially_refunded" | "refunded";
  payer: string;
  txHash: string;
  createdAt: Date;
};

export async function listPayments(merchantId: string, limit = 50): Promise<PaymentListItem[]> {
  const rows = await db
    .select({ p: payments, orderId: checkoutSessions.orderId })
    .from(payments)
    .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
    .where(eq(payments.merchantId, merchantId))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
  return rows.map(({ p, orderId }) => ({
    id: p.id,
    orderId,
    amount: fromUnits(p.amountUnits, p.decimals),
    refunded: fromUnits(p.refundedUnits, p.decimals),
    status: p.status,
    payer: p.payer,
    txHash: p.txHash,
    createdAt: p.createdAt,
  }));
}

export async function paymentStats(merchantId: string) {
  // All USDT amounts share the token's decimals; sum in numeric to stay bigint-safe.
  const [row] = await db
    .select({
      n: count(),
      volume: sql<string>`coalesce(sum(${payments.amountUnits}::numeric), 0)::text`,
      refunded: sql<string>`coalesce(sum(${payments.refundedUnits}::numeric), 0)::text`,
      refundedCount: sql<number>`count(*) filter (where ${payments.refundedUnits} <> '0')::int`,
      decimals: sql<number | null>`max(${payments.decimals})`,
    })
    .from(payments)
    .where(eq(payments.merchantId, merchantId));
  const decimals = row?.decimals ?? 6;
  const toStr = (v: string | undefined) => fromUnits(BigInt((v ?? "0").split(".")[0]), decimals);
  return {
    count: Number(row?.n ?? 0),
    volume: toStr(row?.volume),
    refunded: toStr(row?.refunded),
    refundedCount: Number(row?.refundedCount ?? 0),
    net: fromUnits(BigInt((row?.volume ?? "0").split(".")[0]) - BigInt((row?.refunded ?? "0").split(".")[0]), decimals),
  };
}

export type OnboardingState = {
  business: boolean;
  verified: boolean;
  payout: boolean;
  apiKey: boolean;
  webhook: boolean;
  completed: number;
  total: number;
};

export async function onboardingState(m: Merchant): Promise<OnboardingState> {
  const [[k], [w]] = await Promise.all([
    db.select({ n: count() }).from(apiKeys).where(and(eq(apiKeys.merchantId, m.id), isNull(apiKeys.revokedAt))),
    db.select({ n: count() }).from(webhookEndpoints).where(eq(webhookEndpoints.merchantId, m.id)),
  ]);
  const s = {
    business: !!m.name,
    verified: m.status === "active",
    payout: !!(m.payoutAddress && m.registeredTxHash),
    apiKey: Number(k?.n ?? 0) > 0,
    webhook: Number(w?.n ?? 0) > 0,
  };
  const completed = Object.values(s).filter(Boolean).length;
  return { ...s, completed, total: 5 };
}
