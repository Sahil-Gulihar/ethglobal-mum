import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { fromUnits } from "@whitechain-commerce/core";
import { apiKeys, checkoutSessions, db, payments, refunds, webhookAttempts, webhookDeliveries, webhookEndpoints, webhookEvents } from "@/lib/db";
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

export type RefundView = {
  id: string;
  amount: string;
  amountUnits: string;
  status: "pending" | "succeeded";
  txHash: string | null;
  createdAt: Date;
};

export type PaymentDetail = {
  id: string;
  sessionId: string;
  orderId: string;
  chainPaymentId: string;
  amount: string;
  amountUnits: string;
  refunded: string;
  refundedUnits: string;
  /** paid - refunded onchain - pending requests */
  refundableUnits: string;
  pendingUnits: string;
  decimals: number;
  status: "succeeded" | "partially_refunded" | "refunded";
  payer: string;
  payout: string;
  txHash: string;
  blockNumber: string;
  sessionCreatedAt: Date;
  createdAt: Date;
  metadata: Record<string, string> | null;
  refunds: RefundView[];
};

export async function getPaymentDetail(merchantId: string, paymentId: string): Promise<PaymentDetail | null> {
  const [row] = await db
    .select({ p: payments, s: checkoutSessions })
    .from(payments)
    .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
    .where(and(eq(payments.id, paymentId), eq(payments.merchantId, merchantId)))
    .limit(1);
  if (!row) return null;
  const { p, s } = row;
  const rs = await db
    .select()
    .from(refunds)
    .where(and(eq(refunds.paymentId, p.id), eq(refunds.merchantId, merchantId)))
    .orderBy(asc(refunds.createdAt));
  const pending = rs.filter((r) => r.status === "pending").reduce((a, r) => a + BigInt(r.amountUnits), 0n);
  const left = BigInt(p.amountUnits) - BigInt(p.refundedUnits) - pending;
  return {
    id: p.id,
    sessionId: s.id,
    orderId: s.orderId,
    chainPaymentId: p.chainPaymentId,
    amount: fromUnits(p.amountUnits, p.decimals),
    amountUnits: p.amountUnits,
    refunded: fromUnits(p.refundedUnits, p.decimals),
    refundedUnits: p.refundedUnits,
    refundableUnits: (left > 0n ? left : 0n).toString(),
    pendingUnits: pending.toString(),
    decimals: p.decimals,
    status: p.status,
    payer: p.payer,
    payout: p.payout,
    txHash: p.txHash,
    blockNumber: p.blockNumber.toString(),
    sessionCreatedAt: s.createdAt,
    createdAt: p.createdAt,
    metadata: s.metadata ?? null,
    refunds: rs.map((r) => ({
      id: r.id,
      amount: fromUnits(r.amountUnits, p.decimals),
      amountUnits: r.amountUnits,
      status: r.status,
      txHash: r.txHash,
      createdAt: r.createdAt,
    })),
  };
}

export async function listApiKeys(merchantId: string) {
  return db.select().from(apiKeys).where(eq(apiKeys.merchantId, merchantId)).orderBy(desc(apiKeys.createdAt));
}

export type EndpointView = { id: string; url: string; enabled: boolean; createdAt: Date; secretHint: string };

export async function listEndpoints(merchantId: string): Promise<EndpointView[]> {
  const rows = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.merchantId, merchantId)).orderBy(asc(webhookEndpoints.createdAt));
  return rows.map((r) => ({ id: r.id, url: r.url, enabled: r.enabled, createdAt: r.createdAt, secretHint: `whsec_…${r.secret.slice(-4)}` }));
}

export type AttemptView = { id: string; attempt: number; statusCode: number | null; error: string | null; responseBody: string | null; durationMs: number | null; createdAt: Date };
export type DeliveryView = {
  id: string;
  eventId: string;
  eventType: string;
  endpointId: string;
  endpointUrl: string;
  status: "pending" | "succeeded" | "failed";
  attempts: number;
  lastStatusCode: number | null;
  lastError: string | null;
  nextAttemptAt: Date;
  lastAttemptAt: Date | null;
  createdAt: Date;
  attemptLog: AttemptView[];
};

export async function listDeliveries(merchantId: string, limit = 50): Promise<DeliveryView[]> {
  const rows = await db
    .select({ d: webhookDeliveries, e: webhookEvents, url: webhookEndpoints.url })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .innerJoin(webhookEvents, eq(webhookEvents.id, webhookDeliveries.eventId))
    .where(eq(webhookEndpoints.merchantId, merchantId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
  const ids = rows.map((r) => r.d.id);
  const attempts = ids.length
    ? await db.select().from(webhookAttempts).where(inArray(webhookAttempts.deliveryId, ids)).orderBy(desc(webhookAttempts.createdAt))
    : [];
  const byDelivery = new Map<string, AttemptView[]>();
  for (const a of attempts) {
    const list = byDelivery.get(a.deliveryId) ?? [];
    list.push({ id: a.id, attempt: a.attempt, statusCode: a.statusCode, error: a.error, responseBody: a.responseBody, durationMs: a.durationMs, createdAt: a.createdAt });
    byDelivery.set(a.deliveryId, list);
  }
  return rows.map(({ d, e, url }) => ({
    id: d.id,
    eventId: e.id,
    eventType: e.type,
    endpointId: d.endpointId,
    endpointUrl: url,
    status: d.status,
    attempts: d.attempts,
    lastStatusCode: d.lastStatusCode,
    lastError: d.lastError,
    nextAttemptAt: d.nextAttemptAt,
    lastAttemptAt: d.lastAttemptAt,
    createdAt: d.createdAt,
    attemptLog: byDelivery.get(d.id) ?? [],
  }));
}
