/**
 * The Whitechain Commerce agent toolkit: every tool the MCP server exposes. Each tool is a zod input
 * schema plus a handler that runs as the merchant who owns the API key. Handlers reuse the same
 * library functions as the REST API, so agents and /api/v1 always behave the same way.
 */
import "server-only";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getRouterAddress, USDT_ADDRESS } from "@whitechain-commerce/core";
import type { Merchant } from "@/lib/auth";
import { db, checkoutSessions, paymentLinks, payments } from "@/lib/db";
import { env } from "@/lib/env";
import { randomId } from "@/lib/ids";
import { toPaymentObject } from "@/lib/serializers";
import { createCheckoutSessionForMerchant, getCheckoutSessionForMerchant } from "@/lib/sessions";
import { createPendingRefund, listRefunds } from "@/lib/refunds";
import { createPaymentLinkForMerchant, listPaymentLinks } from "@/lib/payment-links";
import { paymentStats } from "@/app/(app)/dashboard/_lib/queries";

/** A failure the agent should see as a tool error (isError: true), not a protocol error. */
export class ToolError extends Error {}

const decimal = (example: string) =>
  z.string().trim().regex(/^\d+(\.\d+)?$/, `must be a decimal string like "${example}"`).max(40);
const httpUrl = z.url({ protocol: /^https?$/ }).max(2048);

type Annotations = { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };

interface ToolDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  annotations: Annotations;
  run: (m: Merchant, args: z.infer<S>) => Promise<unknown>;
}

const tool = <S extends z.ZodObject>(t: ToolDef<S>) => t as unknown as ToolDef;

const base = () => env.appUrl().replace(/\/$/, "");
const NETWORK = { name: "Whitechain Sepolia (testnet)", chainId: 1874, currency: "USDT", usdt: USDT_ADDRESS };

function unwrap<T>(r: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!r.ok) throw new ToolError(r.message);
  return r.value;
}

export const tools: ToolDef[] = [
  tool({
    name: "get_account",
    title: "Get account",
    description:
      "Returns the merchant account this API key belongs to: business name, verification status, payout wallet, network and contract addresses, and dashboard links. Call this first to check the account can take payments.",
    input: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m) => ({
      merchantId: m.id,
      businessName: m.name,
      status: m.status,
      payoutWallet: m.payoutAddress,
      canAcceptPayments: m.status === "active" && Boolean(m.payoutAddress && m.registeredTxHash),
      network: { ...NETWORK, paymentRouter: getRouterAddress() },
      dashboardUrl: `${base()}/dashboard`,
    }),
  }),

  tool({
    name: "get_sales_summary",
    title: "Get sales summary",
    description: "Returns lifetime totals for the merchant: number of payments, gross USDT volume, refunded USDT and net USDT.",
    input: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m) => ({ currency: "USDT", ...(await paymentStats(m.id)) }),
  }),

  tool({
    name: "create_checkout_session",
    title: "Create checkout session",
    description:
      "Creates a USDT checkout session and returns a hosted checkout `url` to send to the customer. The customer pays from their own wallet straight to the merchant's payout wallet. Sessions expire after 30 minutes. Reusing an orderId returns the existing session instead of creating a new one.",
    input: z.object({
      amount: decimal("49.99").describe('Amount in USDT as a decimal string, e.g. "49.99".'),
      orderId: z.string().trim().min(1).max(200).optional().describe("Your order reference. Generated if omitted. Acts as the idempotency key."),
      description: z.string().trim().max(500).optional().describe("What the customer is paying for. Stored in metadata.description."),
      successUrl: httpUrl.optional().describe("Where to send the customer after a successful payment."),
      cancelUrl: httpUrl.optional().describe("Where to send the customer if they cancel."),
      metadata: z.record(z.string().max(40), z.string().max(500)).optional().describe("Up to 20 string key/value pairs echoed back in webhooks."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (m, a) => {
      const metadata = { ...(a.metadata ?? {}), ...(a.description ? { description: a.description } : {}), source: "mcp" };
      if (Object.keys(metadata).length > 20) throw new ToolError("metadata can have at most 20 keys.");
      return unwrap(
        await createCheckoutSessionForMerchant(m, {
          orderId: a.orderId ?? `agent_${randomId(12)}`,
          amount: a.amount,
          successUrl: a.successUrl,
          cancelUrl: a.cancelUrl,
          metadata,
        }),
      );
    },
  }),

  tool({
    name: "get_checkout_session",
    title: "Get checkout session",
    description: "Looks up a checkout session by id (cs_...). Use it to check whether the customer has paid: status is open, processing, complete or expired.",
    input: z.object({ sessionId: z.string().trim().min(1).max(100).describe("The checkout session id, cs_...") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => {
      const s = await getCheckoutSessionForMerchant(m.id, a.sessionId);
      if (!s) throw new ToolError(`No checkout session ${a.sessionId}.`);
      return s;
    },
  }),

  tool({
    name: "list_payments",
    title: "List payments",
    description: "Lists confirmed onchain payments, newest first, with amount, refunded amount, payer wallet and transaction hash.",
    input: z.object({ limit: z.number().int().min(1).max(100).optional().describe("How many payments to return, 1 to 100. Default 20.") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => {
      const rows = await db
        .select({ p: payments, s: checkoutSessions })
        .from(payments)
        .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
        .where(eq(payments.merchantId, m.id))
        .orderBy(desc(payments.createdAt), desc(payments.blockNumber))
        .limit(a.limit ?? 20);
      return { data: rows.map(({ p, s }) => toPaymentObject(p, s)) };
    },
  }),

  tool({
    name: "get_payment",
    title: "Get payment",
    description: "Returns one payment (pay_...) together with its refunds.",
    input: z.object({ paymentId: z.string().trim().min(1).max(100).describe("The payment id, pay_...") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => {
      const [row] = await db
        .select({ p: payments, s: checkoutSessions })
        .from(payments)
        .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
        .where(and(eq(payments.id, a.paymentId), eq(payments.merchantId, m.id)))
        .limit(1);
      if (!row) throw new ToolError(`No payment ${a.paymentId}.`);
      return {
        ...toPaymentObject(row.p, row.s),
        refunds: await listRefunds(m.id, { paymentId: a.paymentId }),
        dashboardUrl: `${base()}/dashboard/payments/${a.paymentId}`,
      };
    },
  }),

  tool({
    name: "create_refund",
    title: "Create refund",
    description:
      "Starts a full or partial refund of a payment. Refunds are non-custodial: this creates a PENDING refund, and the merchant must approve it by signing with their payout wallet on the returned approveUrl. Tell the user to open that link; the agent cannot move funds.",
    input: z.object({
      paymentId: z.string().trim().min(1).max(100).describe("The payment id, pay_..."),
      amount: decimal("10.00").describe("Amount to refund in USDT. Cannot exceed what is left to refund."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: async (m, a) => ({
      ...unwrap(await createPendingRefund(m.id, a)),
      approveUrl: `${base()}/dashboard/payments/${a.paymentId}`,
    }),
  }),

  tool({
    name: "list_refunds",
    title: "List refunds",
    description: "Lists refunds, newest first, optionally only those for one payment. Status is pending, succeeded or failed.",
    input: z.object({ paymentId: z.string().trim().min(1).max(100).optional().describe("Only refunds of this payment, pay_...") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => ({ data: await listRefunds(m.id, { paymentId: a.paymentId }) }),
  }),

  tool({
    name: "create_payment_link",
    title: "Create payment link",
    description:
      "Creates a reusable payment link with a fixed USDT amount and returns its public url (/pay/pl_...). Anyone who opens it gets a fresh checkout. Good for invoices, tips and selling one product in chat or social posts.",
    input: z.object({
      name: z.string().trim().min(1).max(80).describe('What is being sold, e.g. "Consulting call".'),
      amount: decimal("25.00").describe("Fixed price in USDT."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    run: async (m, a) => {
      const l = unwrap(await createPaymentLinkForMerchant(m, a));
      return { id: l.id, name: l.name, amount: l.amount, currency: "USDT", active: l.active, url: `${base()}/pay/${l.id}` };
    },
  }),

  tool({
    name: "list_payment_links",
    title: "List payment links",
    description: "Lists the merchant's payment links with their url, price, whether they are on, and how many payments each has taken.",
    input: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m) => ({
      data: (await listPaymentLinks(m.id)).map((l) => ({
        id: l.id,
        name: l.name,
        amount: l.amount,
        currency: "USDT",
        active: l.active,
        url: `${base()}/pay/${l.id}`,
        paidCount: l.paidCount,
        paidTotal: l.paidTotal,
        createdAt: l.createdAt.toISOString(),
      })),
    }),
  }),

  tool({
    name: "set_payment_link_active",
    title: "Turn a payment link on or off",
    description: "Turns a payment link on or off. A link that is off shows an error page instead of a checkout.",
    input: z.object({
      linkId: z.string().trim().min(1).max(100).describe("The payment link id, pl_..."),
      active: z.boolean().describe("true to turn the link on, false to turn it off."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (m, a) => {
      const rows = await db
        .update(paymentLinks)
        .set({ active: a.active })
        .where(and(eq(paymentLinks.id, a.linkId), eq(paymentLinks.merchantId, m.id)))
        .returning({ id: paymentLinks.id, active: paymentLinks.active });
      if (!rows.length) throw new ToolError(`No payment link ${a.linkId}.`);
      return rows[0];
    },
  }),
];

export const toolsByName = new Map(tools.map((t) => [t.name, t]));

/** The tools/list entry for a tool, with its zod schema rendered as JSON Schema. */
export function describeTool(t: ToolDef) {
  const inputSchema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  delete inputSchema.$schema;
  return { name: t.name, title: t.title, description: t.description, inputSchema, annotations: { title: t.title, ...t.annotations } };
}
