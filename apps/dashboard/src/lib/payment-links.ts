/**
 * Payment links: a reusable URL (/pay/pl_...) with a fixed amount. Every visit opens a fresh hosted
 * checkout session, tagged with metadata.payment_link so payments can be traced back to the link.
 */
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { checkoutSessions, db, merchants, paymentLinks, payments } from "./db";
import { randomId } from "./ids";
import { createCheckoutSessionForMerchant, type SessionResult } from "./sessions";

export type PaymentLinkView = typeof paymentLinks.$inferSelect & { paidCount: number; paidTotal: string };

export async function listPaymentLinks(merchantId: string): Promise<PaymentLinkView[]> {
  const links = await db
    .select()
    .from(paymentLinks)
    .where(eq(paymentLinks.merchantId, merchantId))
    .orderBy(desc(paymentLinks.createdAt));
  if (!links.length) return [];
  const stats = await db
    .select({
      linkId: sql<string>`${checkoutSessions.metadata}->>'payment_link'`,
      n: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${checkoutSessions.amount}::numeric), 0)::text`,
    })
    .from(checkoutSessions)
    .innerJoin(payments, eq(payments.sessionId, checkoutSessions.id))
    .where(and(eq(checkoutSessions.merchantId, merchantId), sql`${checkoutSessions.metadata} ? 'payment_link'`))
    .groupBy(sql`1`);
  const byId = new Map(stats.map((s) => [s.linkId, s]));
  return links.map((l) => {
    const s = byId.get(l.id);
    return { ...l, paidCount: s?.n ?? 0, paidTotal: s ? Number(s.total).toFixed(2) : "0.00" };
  });
}

/** Opens a new checkout session for a public payment link. Returns the session id to redirect to. */
export async function openPaymentLink(linkId: string): Promise<SessionResult<{ sessionId: string; name: string }>> {
  const [row] = await db
    .select({ l: paymentLinks, m: merchants })
    .from(paymentLinks)
    .innerJoin(merchants, eq(merchants.id, paymentLinks.merchantId))
    .where(eq(paymentLinks.id, linkId))
    .limit(1);
  if (!row) return { ok: false, status: 404, type: "not_found", message: "This payment link doesn't exist." };
  if (!row.l.active) return { ok: false, status: 410, type: "conflict", message: "This payment link has been turned off by the merchant." };
  const r = await createCheckoutSessionForMerchant(row.m, {
    orderId: `${row.l.id}_${randomId(10)}`,
    amount: row.l.amount,
    metadata: { payment_link: row.l.id, payment_link_name: row.l.name.slice(0, 500) },
  });
  if (!r.ok) return r;
  return { ok: true, value: { sessionId: r.value.id, name: row.l.name } };
}
