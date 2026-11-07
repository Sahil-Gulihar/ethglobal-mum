/**
 * The White Money agent toolkit: every tool the MCP server exposes. Each tool is a zod input
 * schema plus a handler that runs as the merchant who owns the API key. Handlers reuse the same
 * library functions as the REST API, so agents and /api/v1 always behave the same way.
 */
import "server-only";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getRouterAddress, USDT_ADDRESS } from "@whitechain-commerce/core";
import type { Merchant } from "@/lib/auth";
import { db, checkoutSessions, merchants, paymentLinks, payments } from "@/lib/db";
import { env } from "@/lib/env";
import { randomId } from "@/lib/ids";
import { toPaymentObject } from "@/lib/serializers";
import { createCheckoutSessionForMerchant, getCheckoutSessionForMerchant } from "@/lib/sessions";
import { createPendingRefund, discardPendingRefund, listRefunds } from "@/lib/refunds";
import { createPaymentLinkForMerchant, listPaymentLinks } from "@/lib/payment-links";
import { buildLedgerCsv, parseLedgerRange } from "@/lib/csv-export";
import {
  addWebhookEndpoint,
  listWebhookEndpoints,
  redeliverForMerchant,
  removeWebhookEndpoint,
  setEndpointEnabled,
  testEndpoint,
  webhookSecret,
} from "@/lib/webhooks/endpoints";
import { INTEGRATION_MODES, INTEGRATION_STACKS, integrationGuide } from "@/lib/agent/integration-guide";
import { dailyPayments, listDeliveries, listLedgerEntries, onboardingState, paymentStats } from "@/app/(app)/dashboard/_lib/queries";

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
const NETWORK = { name: "Chain 1874", chainId: 1874, currency: "USDT", usdt: USDT_ADDRESS };

/**
 * Some steps are reserved for the human on purpose (identity, the payout wallet, signing refunds,
 * minting keys). Tools hand those off with a link the agent shows to its user.
 */
const humanAction = (reason: string, path: string) => ({ reason, url: `${base()}${path}` });

function unwrap<T>(r: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!r.ok) throw new ToolError(r.message);
  return r.value;
}

export const tools: ToolDef[] = [
  tool({
    name: "get_account",
    title: "Get account",
    description:
      "Returns the merchant account this API key belongs to: business name, verification status, payout wallet, setup checklist, network and contract addresses. Call this first. If canAcceptPayments is false, show the user the humanActions links: those steps need the human.",
    input: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m) => {
      const setup = await onboardingState(m);
      const humanActions = [
        ...(setup.verified ? [] : [humanAction("Verify you're a unique human with World ID before taking payments.", "/dashboard/setup")]),
        ...(setup.payout ? [] : [humanAction("Connect the wallet that receives payments. Only the account owner can set or change it.", "/dashboard/settings")]),
      ];
      return {
        merchantId: m.id,
        businessName: m.name,
        status: m.status,
        payoutWallet: m.payoutAddress,
        canAcceptPayments: setup.verified && setup.payout,
        setup: { ...setup, webhookHint: setup.webhook ? undefined : "No webhook endpoint yet. Use create_webhook_endpoint." },
        humanActions,
        network: { ...NETWORK, paymentRouter: getRouterAddress() },
        dashboardUrl: `${base()}/dashboard`,
      };
    },
  }),

  tool({
    name: "get_integration_guide",
    title: "Get the integration guide",
    description:
      "Returns step-by-step instructions (Markdown) for adding White Money checkout to a codebase: what to inspect, env vars, server route, checkout UI, webhook verification, testing and a final checklist. Coding agents: call this before writing integration code and follow it.",
    input: z.object({
      stack: z.enum(INTEGRATION_STACKS.map((s) => s.id) as [string, ...string[]]).optional().describe(`The repo's stack: ${INTEGRATION_STACKS.map((s) => `${s.id} (${s.label})`).join(", ")}. Default other.`),
      mode: z.enum(INTEGRATION_MODES.map((m) => m.id) as [string, ...string[]]).optional().describe(`How customers pay: ${INTEGRATION_MODES.map((m) => `${m.id} (${m.label})`).join(", ")}. Default: hosted (the widget package is not on npm yet; use widget only if @whitechain-commerce/react resolves in the repo).`),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (_m, a) =>
      integrationGuide({ baseUrl: base(), stack: a.stack as never, mode: a.mode as never }),
  }),

  tool({
    name: "get_sales_summary",
    title: "Get sales summary",
    description:
      "Returns lifetime totals (number of payments, gross, refunded and net USDT) and the number of payments per day for the last 14 days (UTC).",
    input: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m) => ({ currency: "USDT", ...(await paymentStats(m.id)), last14Days: await dailyPayments(m.id) }),
  }),

  tool({
    name: "update_business_name",
    title: "Rename the business",
    description: "Changes the business name customers see on checkout pages.",
    input: z.object({ name: z.string().trim().min(2).max(80).describe("The new business name, 2 to 80 characters.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (m, a) => {
      await db.update(merchants).set({ name: a.name }).where(eq(merchants.id, m.id));
      return { businessName: a.name };
    },
  }),

  tool({
    name: "export_ledger_csv",
    title: "Export ledger CSV",
    description:
      "Returns the accounting ledger as CSV text: every payment and every completed refund, oldest first. Optional from/to are ISO dates (YYYY-MM-DD, to is inclusive).",
    input: z.object({
      from: z.string().trim().max(40).optional().describe("Start date, e.g. 2026-11-01."),
      to: z.string().trim().max(40).optional().describe("End date, inclusive, e.g. 2026-11-30."),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => {
      const r = parseLedgerRange(a.from ?? null, a.to ?? null);
      if ("error" in r) throw new ToolError(r.error);
      const entries = await listLedgerEntries(m.id, r.range);
      return { rows: entries.length, csv: buildLedgerCsv(entries), downloadUrl: `${base()}/dashboard/payments/export` };
    },
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
      requireVerifiedBuyer: z.boolean().optional().describe("Verified buyers: the customer must prove they're human with World ID before they can pay."),
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
          requireVerifiedBuyer: a.requireVerifiedBuyer,
        }),
      );
    },
  }),

  tool({
    name: "get_checkout_session",
    title: "Get checkout session",
    description: "Looks up a checkout session by id (cs_...). Use it to check whether the customer has paid: status is open, processing (a transaction was reported and is being checked), paid or expired. Use wait_for_payment to wait for it.",
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
    run: async (m, a) => {
      const refund = unwrap(await createPendingRefund(m.id, a));
      const action = humanAction("Sign the refund with the payout wallet to send the USDT back.", `/dashboard/payments/${a.paymentId}`);
      return { ...refund, approveUrl: action.url, humanActions: [action] };
    },
  }),

  tool({
    name: "cancel_refund",
    title: "Cancel a pending refund",
    description: "Discards a pending refund that hasn't been signed yet. Refunds already sent onchain can't be cancelled.",
    input: z.object({ refundId: z.string().trim().min(1).max(100).describe("The refund id, re_...") }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: async (m, a) => {
      const paymentId = await discardPendingRefund(m.id, a.refundId);
      if (!paymentId) throw new ToolError("This refund can't be cancelled: it doesn't exist or was already signed.");
      return { id: a.refundId, paymentId, cancelled: true };
    },
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
    name: "get_payment_link",
    title: "Get payment link",
    description: "Returns one payment link with its url and the most recent checkouts opened from it, including which were paid.",
    input: z.object({ linkId: z.string().trim().min(1).max(100).describe("The payment link id, pl_...") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => {
      const link = (await listPaymentLinks(m.id)).find((l) => l.id === a.linkId);
      if (!link) throw new ToolError(`No payment link ${a.linkId}.`);
      const sessions = await linkSessions(m.id, a.linkId, 10);
      return {
        id: link.id,
        name: link.name,
        amount: link.amount,
        currency: "USDT",
        active: link.active,
        url: `${base()}/pay/${link.id}`,
        paidCount: link.paidCount,
        paidTotal: link.paidTotal,
        recentCheckouts: sessions.map(({ s, p }) => ({
          sessionId: s.id,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          payment: p ? toPaymentObject(p, s) : null,
        })),
      };
    },
  }),

  tool({
    name: "wait_for_payment",
    title: "Wait for a payment",
    description:
      "Waits until a checkout session (sessionId) or any checkout of a payment link (paymentLinkId) is paid, and returns the confirmed payment with its explorer link. While waiting it checks the chain itself (reported transactions first, then a scan of new PaymentRouter events), so it confirms payments even when no background worker runs and the customer closed the page before the checkout reported the transaction. For a payment link, only checkouts opened after `since` count (default: the last 30 minutes). Returns paid: false after timeoutSeconds; call it again to keep waiting.",
    input: z
      .object({
        sessionId: z.string().trim().min(1).max(100).optional().describe("Checkout session id, cs_..."),
        paymentLinkId: z.string().trim().min(1).max(100).optional().describe("Payment link id, pl_..."),
        since: z.iso.datetime({ offset: true }).optional().describe("ISO time; for payment links, ignore checkouts opened before this."),
        timeoutSeconds: z.number().int().min(0).max(50).optional().describe("How long to wait, 0 to 50 seconds. Default 30."),
      })
      .refine((v) => Boolean(v.sessionId) !== Boolean(v.paymentLinkId), "pass exactly one of sessionId or paymentLinkId"),
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: async (m, a) => {
      const deadline = Date.now() + (a.timeoutSeconds ?? 30) * 1000;
      const since = a.since ? new Date(a.since) : new Date(Date.now() - 30 * 60_000);
      const { validateTx, runIndexerOnce } = await import("@/lib/indexer");
      const checked = new Set<string>();
      let lastScan = 0;
      for (;;) {
        const rows = a.sessionId ? await sessionWithPayment(m.id, a.sessionId) : await linkSessions(m.id, a.paymentLinkId!, 20, since);
        if (a.sessionId && !rows.length) throw new ToolError(`No checkout session ${a.sessionId}.`);
        const paid = rows.find(({ p }) => p);
        if (paid?.p) {
          return { paid: true, sessionId: paid.s.id, payment: toPaymentObject(paid.p, paid.s) };
        }
        // Re-check reported transactions onchain (the widget's submit hint), once per hash per call.
        const hints = rows.map(({ s }) => s.submittedTxHash).filter((h): h is string => Boolean(h) && !checked.has(h!));
        for (const h of hints) {
          checked.add(h);
          await validateTx(h).catch(() => null);
        }
        if (hints.length) continue;
        // No usable hint: scan new router events ourselves (idempotent, shares the worker's cursor).
        if (Date.now() - lastScan >= 6000) {
          lastScan = Date.now();
          const r = await runIndexerOnce().catch((e: unknown) => (console.warn("[mcp] wait_for_payment scan", e), null));
          if (r?.processed) continue;
        }
        if (Date.now() >= deadline) {
          return {
            paid: false,
            checkouts: rows.map(({ s }) => ({ sessionId: s.id, status: s.status, reportedTxHash: s.submittedTxHash })),
            hint: "Not paid yet. Call wait_for_payment again to keep waiting.",
          };
        }
        await new Promise((r) => setTimeout(r, Math.min(2000, Math.max(0, deadline - Date.now()))));
        checked.clear();
      }
    },
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

  tool({
    name: "list_webhook_endpoints",
    title: "List webhook endpoints",
    description: "Lists the URLs that receive payment.succeeded and refund.succeeded events, and whether each is on.",
    input: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m) => ({ data: (await listWebhookEndpoints(m.id)).map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })) }),
  }),

  tool({
    name: "create_webhook_endpoint",
    title: "Add a webhook endpoint",
    description:
      "Registers a public URL to receive signed payment.succeeded and refund.succeeded events and returns its signing secret (whsec_...). Store the secret as WC_WEBHOOK_SECRET in the merchant's server environment, never in code. Then call send_test_webhook to check the endpoint.",
    input: z.object({ url: httpUrl.describe("Public http(s) URL, e.g. https://shop.example.com/api/webhooks/whitechain.") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: async (m, a) => unwrap(await addWebhookEndpoint(m.id, a.url)),
  }),

  tool({
    name: "get_webhook_secret",
    title: "Get a webhook signing secret",
    description: "Returns the signing secret (whsec_...) of a webhook endpoint, for configuring WC_WEBHOOK_SECRET.",
    input: z.object({ endpointId: z.string().trim().min(1).max(100).describe("The endpoint id, we_...") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => ({ endpointId: a.endpointId, secret: unwrap(await webhookSecret(m.id, a.endpointId)) }),
  }),

  tool({
    name: "set_webhook_endpoint_enabled",
    title: "Turn a webhook endpoint on or off",
    description: "Pauses or resumes deliveries to a webhook endpoint.",
    input: z.object({
      endpointId: z.string().trim().min(1).max(100).describe("The endpoint id, we_..."),
      enabled: z.boolean().describe("true to deliver events, false to pause."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    run: async (m, a) => unwrap(await setEndpointEnabled(m.id, a.endpointId, a.enabled)),
  }),

  tool({
    name: "delete_webhook_endpoint",
    title: "Delete a webhook endpoint",
    description: "Removes a webhook endpoint and stops all deliveries to it. Confirm with the user first.",
    input: z.object({ endpointId: z.string().trim().min(1).max(100).describe("The endpoint id, we_...") }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    run: async (m, a) => ({ ...unwrap(await removeWebhookEndpoint(m.id, a.endpointId)), deleted: true }),
  }),

  tool({
    name: "send_test_webhook",
    title: "Send a test webhook",
    description:
      "Sends a signed test payment.succeeded event (payment id pay_test_..., orderId test_order) to one endpoint right now and reports the HTTP status. A 2xx means the endpoint verified and accepted it.",
    input: z.object({ endpointId: z.string().trim().min(1).max(100).describe("The endpoint id, we_...") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: async (m, a) => unwrap(await testEndpoint(m.id, a.endpointId)),
  }),

  tool({
    name: "list_webhook_deliveries",
    title: "List webhook deliveries",
    description: "Shows recent webhook deliveries with status (pending, succeeded, failed), attempts, last HTTP status and error. Use it to debug an endpoint.",
    input: z.object({ limit: z.number().int().min(1).max(50).optional().describe("How many deliveries, 1 to 50. Default 20.") }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    run: async (m, a) => ({
      data: (await listDeliveries(m.id, a.limit ?? 20)).map((d) => ({
        id: d.id,
        eventId: d.eventId,
        eventType: d.eventType,
        isTest: d.isTest,
        endpointUrl: d.endpointUrl,
        status: d.status,
        attempts: d.attempts,
        lastStatusCode: d.lastStatusCode,
        lastError: d.lastError,
        createdAt: d.createdAt.toISOString(),
      })),
    }),
  }),

  tool({
    name: "redeliver_webhook",
    title: "Redeliver a webhook",
    description: "Sends a past webhook delivery again right now, for example after fixing the endpoint.",
    input: z.object({ deliveryId: z.string().trim().min(1).max(100).describe("The delivery id, whd_...") }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    run: async (m, a) => unwrap(await redeliverForMerchant(m.id, a.deliveryId)),
  }),
];

async function sessionWithPayment(merchantId: string, sessionId: string) {
  return db
    .select({ s: checkoutSessions, p: payments })
    .from(checkoutSessions)
    .leftJoin(payments, eq(payments.sessionId, checkoutSessions.id))
    .where(and(eq(checkoutSessions.id, sessionId), eq(checkoutSessions.merchantId, merchantId)))
    .limit(1);
}

/** Checkouts opened from a payment link, newest first, optionally only those created since a time. */
async function linkSessions(merchantId: string, linkId: string, limit: number, since?: Date) {
  return db
    .select({ s: checkoutSessions, p: payments })
    .from(checkoutSessions)
    .leftJoin(payments, eq(payments.sessionId, checkoutSessions.id))
    .where(
      and(
        eq(checkoutSessions.merchantId, merchantId),
        sql`${checkoutSessions.metadata}->>'payment_link' = ${linkId}`,
        since ? gte(checkoutSessions.createdAt, since) : undefined,
      ),
    )
    .orderBy(desc(checkoutSessions.createdAt))
    .limit(limit);
}

export const toolsByName = new Map(tools.map((t) => [t.name, t]));

/** The tools/list entry for a tool, with its zod schema rendered as JSON Schema. */
export function describeTool(t: ToolDef) {
  const inputSchema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  delete inputSchema.$schema;
  return { name: t.name, title: t.title, description: t.description, inputSchema, annotations: { title: t.title, ...t.annotations } };
}
