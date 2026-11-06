/**
 * Payment links: a reusable URL (/pay/pl_...) with a fixed amount. Every visit opens a fresh hosted
 * checkout session, tagged with metadata.payment_link so payments can be traced back to the link.
 */
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { fromUnits, toUnits } from "@whitechain-commerce/core";
import type { Merchant } from "./auth";
import { usdtDecimals } from "./chain";
import { checkoutSessions, db, merchants, paymentLinks, payments } from "./db";
import { newId, randomId } from "./ids";
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

/** Validates and stores a new payment link. Shared by the dashboard action and the MCP server. */
export async function createPaymentLinkForMerchant(
  m: Merchant,
  input: { name: string; amount: string },
): Promise<SessionResult<typeof paymentLinks.$inferSelect>> {
  const fail = (status: number, type: "invalid_request" | "conflict", message: string) =>
    ({ ok: false, status, type, message }) as const;
  if (m.status !== "active") return fail(409, "conflict", "Verify your account before creating payment links.");
  if (!m.payoutAddress || !m.registeredTxHash) return fail(409, "conflict", "Set your payout wallet in Settings first.");
  const name = input.name.trim().slice(0, 80);
  if (!name) return fail(400, "invalid_request", 'Give the link a name, like "Consulting call".');
  const raw = input.amount.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return fail(400, "invalid_request", "Enter an amount like 25 or 25.50.");
  let amount: string;
  try {
    const decimals = await usdtDecimals();
    const units = toUnits(raw, decimals);
    if (units <= 0n) return fail(400, "invalid_request", "The amount must be more than 0.");
    amount = fromUnits(units, decimals);
  } catch (e) {
    return fail(400, "invalid_request", e instanceof Error ? e.message : "Invalid amount.");
  }
  const [row] = await db.insert(paymentLinks).values({ id: newId("pl"), merchantId: m.id, name, amount }).returning();
  return { ok: true, value: row };
}
