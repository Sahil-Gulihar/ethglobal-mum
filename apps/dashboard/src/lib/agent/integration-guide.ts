/**
 * The canonical "integrate White Money" prompt for coding agents, served as Markdown at
 * /integrate.md. Pure function: no DB, no env, safe to import anywhere.
 *
 * Every code sample here must match the real API (apps/dashboard/src/app/api/v1), the webhook format
 * (packages/core/src/webhooks.ts) and the widget props (packages/react/src/WhitechainCheckout.tsx).
 * The @whitechain-commerce/* packages are not published to npm, so server code is dependency-free
 * (fetch + node:crypto) and the React widget is only offered when the package can be installed.
 */

export type IntegrationStack = "nextjs" | "react-node" | "node" | "other";
export type IntegrationMode = "widget" | "hosted" | "payment-link";

export const INTEGRATION_STACKS: { id: IntegrationStack; label: string }[] = [
  { id: "nextjs", label: "Next.js (App Router)" },
  { id: "react-node", label: "React frontend + Node.js backend" },
  { id: "node", label: "Node.js server (Express or similar)" },
  { id: "other", label: "Any other stack" },
];

export const INTEGRATION_MODES: { id: IntegrationMode; label: string }[] = [
  { id: "widget", label: "Embedded widget" },
  { id: "hosted", label: "Hosted checkout" },
  { id: "payment-link", label: "Payment link (no code)" },
];

const fence = (lang: string, body: string) => "```" + lang + "\n" + body.trim() + "\n```";

export function integrationGuide(opts: { baseUrl: string; stack?: IntegrationStack; mode?: IntegrationMode }): string {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const stack: IntegrationStack = opts.stack ?? "other";
  if (opts.mode === "payment-link") return paymentLinkGuide(base);
  // Default: hosted everywhere. The widget package is not on npm yet, so it is opt-in (mode=widget).
  const mode: "widget" | "hosted" = opts.mode ?? "hosted";
  const stackLabel = INTEGRATION_STACKS.find((s) => s.id === stack)!.label;

  const parts = [
    header(base, stackLabel, mode, opts.mode === undefined),
    mcpSection(base),
    inspectSection(),
    decisionSection(base),
    accountSection(base),
    envSection(base, stack, mode),
    stepsIntro(),
    stack === "nextjs" ? nextSteps(mode) : expressSteps(stack, mode),
    stack === "other" ? otherStackNotes() : "",
    securitySection(),
    testingSection(base),
    checklistSection(mode),
    referenceSection(base),
  ];
  return parts.filter(Boolean).join("\n\n") + "\n";
}

// ---------------------------------------------------------------------------------------------

function header(base: string, stackLabel: string, mode: "widget" | "hosted", defaulted: boolean) {
  return `# Integrate White Money checkout (instructions for coding agents)

You are a coding agent working inside a merchant's repository. Follow these instructions end to end to add White Money checkout. Do the work in the repository, then verify every item in the **Final checklist** before you say you are done.

White Money is a non-custodial USDT checkout. The customer pays from their own wallet straight to the merchant's payout wallet; the platform never holds funds. The merchant's server creates a **checkout session** with a secret key, the customer pays it (embedded widget or hosted page), and the platform sends a signed **\`payment.succeeded\` webhook** to the merchant's server, which fulfils the order.

- API base: \`${base}\`
- Stack for this guide: **${stackLabel}**
- Checkout mode: **${mode === "widget" ? "embedded widget" : "hosted checkout"}**${defaulted ? " (the default: `@whitechain-commerce/react` is not on npm yet, so use `mode=widget` only if the package resolves in this repo, see Step 0)" : ""}
- Other variants of this guide: \`${base}/integrate.md?stack=nextjs|react-node|node|other&mode=widget|hosted|payment-link\`
- Full docs: ${base}/docs (plain text index: ${base}/docs/llms.txt)

## Goal

When you are done, the repository must:

1. Create a checkout session **on the server** for an order, with the amount computed from server-side data and the merchant's own order id as \`orderId\` (the idempotency key).
2. Send the customer to pay it (widget or hosted page).
3. Receive the \`payment.succeeded\` webhook, verify its signature on the **raw body**, and mark the order paid **exactly once**, only if the paid amount equals the order total.
4. Record \`refund.succeeded\` webhooks against the order.
5. Show the customer an order status page that waits for the server to see the webhook.`;
}

function mcpSection(base: string) {
  return `## If the \`whitechain\` MCP server is connected

Check your tool list for the \`whitechain\` MCP server (hosted at \`${base}/api/mcp\`, authenticated with the merchant's \`sk_test_...\` key). If it is connected, use it instead of asking the human to click through the dashboard:

| Tool | Use it to |
| --- | --- |
| \`get_account\` | First call. Check \`canAcceptPayments\` is \`true\`. If it is \`false\`, stop and tell the human to finish verification and register a payout wallet at ${base}/dashboard/setup. Sessions cannot be created until then. |
| \`create_webhook_endpoint\` | Register the webhook URL you build below (it must be reachable by the platform). It returns the endpoint's signing secret (\`whsec_...\`): put it in \`WC_WEBHOOK_SECRET\` in the local env file, never in committed code. |
| \`send_test_webhook\` | Send a signed test \`payment.succeeded\` to that endpoint to prove signature verification works. |
| \`create_checkout_session\` / \`get_checkout_session\` | Create a test session (returns the hosted \`url\`) and check its status after a test payment. |
| \`list_payments\` | Confirm a test payment was recorded. |

If the MCP server is not connected, the human can add it with \`npx whitechain-mcp init\` in the repo root (see ${base}/docs/agents), or do the same steps in the dashboard. Do not block on it.`;
}

function inspectSection() {
  return `## Step 0: inspect the repository first

Before writing code, find out and note down:

1. **Framework and runtime.** Next.js (App Router or Pages Router, and the version: read \`package.json\`; recent Next.js versions change APIs, so check the repo's \`node_modules/next/dist/docs\` or AGENTS.md if present), Express, Fastify, NestJS, Hono, Remix, SvelteKit, Django, Rails, Laravel... Note whether server code can run on Node.js (webhook verification needs HMAC-SHA256; \`node:crypto\` is used below).
2. **Where orders and carts live.** The order model/table, how the total is computed (prices must come from the server-side catalog or database, not from the client), the currency and precision (cents? decimals?), and existing order statuses. **If the app has no orders or database yet** (for example a static product catalog), add the minimum: an orders table and a processed-webhook-events table, through the repo's ORM if it has one. Otherwise use a small SQL database: SQLite (\`node:sqlite\` on Node 22.13+, or \`better-sqlite3\`) for a single long-running server, or a hosted Postgres on serverless platforms such as Vercel, where the filesystem does not persist. Add a \`POST /api/orders\` route that takes product ids and quantities, prices them from the server-side catalog, and creates a \`pending\` order with a random, hard-to-guess id (for example \`ord_\` + \`crypto.randomUUID()\`): without customer accounts, that id is what keeps one customer's order page private.
3. **Env handling.** \`.env\`, \`.env.local\`, \`.env.example\`, a typed env module (zod, t3-env, \`process.env\` wrappers), secrets in the deploy platform. Follow the existing pattern; add new variables to \`.env.example\` with empty values.
4. **Existing payment code.** Stripe or other checkouts, webhook routes, "mark paid" functions, fulfilment jobs, emails. Reuse the existing order state machine and fulfilment function; add Whitechain as another way to pay, do not rewrite the flow.
5. **Persistence for idempotency.** Where you can store the session id on the order and a processed-webhook-event table (or column) with a unique key.
6. **The app's public URL** (for \`successUrl\`/\`cancelUrl\`) and how routes are named.
7. **Whether \`@whitechain-commerce/react\` can be installed.** It is not on the public npm registry yet (\`npm view @whitechain-commerce/react\` returns 404). It is only available inside the White Money monorepo as a workspace package (\`"@whitechain-commerce/react": "workspace:*"\`). If you cannot install it, use the hosted checkout; the rest of this guide does not need any Whitechain package.`;
}

function decisionSection(base: string) {
  return `## Choose the integration

| Mode | Choose it when | Frontend work |
| --- | --- | --- |
| **Hosted checkout** | Any backend, not React, the fastest integration, or \`@whitechain-commerce/react\` cannot be installed. | None: redirect the customer to \`session.url\` (\`${base}/checkout/cs_...\`). The page redirects to \`successUrl\` about 2 seconds after the payment is confirmed. |
| **Embedded widget** | React 18+ frontend, the customer should stay on the merchant's page, and \`@whitechain-commerce/react\` is installable. | Render \`<WhitechainCheckout sessionId apiBase onSuccess />\`. It does not redirect on its own; \`onSuccess\` decides. |
| **Payment link** | No code at all: a fixed price, a single product, donations, invoices. | Put a link URL behind a button. See \`${base}/integrate.md?mode=payment-link\`. |

Sessions, onchain payments and webhooks are identical for the hosted and widget modes, so the server code below is the same. If in doubt, ship hosted checkout first.`;
}

function accountSection(base: string) {
  return `## Merchant account prerequisites

These need a human (or the MCP tools above). Check them, and if any is missing, tell the human exactly what to do:

1. Account at ${base}/signup, verified, with a **payout wallet registered** at ${base}/dashboard/setup. Without a payout wallet, \`POST /api/v1/checkout_sessions\` returns \`409 conflict\`.
2. A **secret key** (\`sk_test_...\`) from ${base}/dashboard/developers.
3. A **webhook endpoint** for the webhook URL you build below, added at ${base}/dashboard/webhooks (or with \`create_webhook_endpoint\`). Each endpoint has its own signing secret \`whsec_...\` (click **Reveal**). Every endpoint receives every event type.

Never ask the human to paste the secret key or webhook secret into chat or into committed files. Ask them to put the values in the local env file themselves, or write them there yourself if you received them from a tool.`;
}

function envSection(base: string, stack: IntegrationStack, mode: "widget" | "hosted") {
  const rows = [
    `| \`WC_SECRET_KEY\` | Server only | \`sk_test_...\` | Authenticates \`POST /api/v1/checkout_sessions\`. Never expose it to the browser, never prefix it with \`NEXT_PUBLIC_\`/\`VITE_\`. |`,
    `| \`WC_WEBHOOK_SECRET\` | Server only | \`whsec_...\` | Signing secret of the webhook endpoint. Used to verify the \`WC-Signature\` header. |`,
    `| \`WC_API_BASE\` | Server | \`${base}\` | White Money API origin, no trailing slash. |`,
  ];
  if (mode === "widget" && stack === "nextjs")
    rows.push(
      `| \`NEXT_PUBLIC_WC_API_BASE\` | Browser | \`${base}\` | Read by the widget. The widget defaults to this variable, then to the page's own origin, which is wrong for a merchant site, so always pass it as \`apiBase\`. |`,
    );
  if (mode === "widget" && stack !== "nextjs")
    rows.push(
      `| \`VITE_WC_API_BASE\` (or your bundler's public prefix) | Browser | \`${base}\` | Pass it to the widget as \`apiBase\`. Outside Next.js the widget cannot read env vars itself. |`,
    );
  rows.push(
    `| Your app's public URL (reuse the existing variable, else add \`APP_URL\`) | Server | \`https://shop.example.com\` | Builds \`successUrl\` and \`cancelUrl\`. |`,
  );
  return `## Environment variables

| Name | Where | Example | Purpose |
| --- | --- | --- | --- |
${rows.join("\n")}

Add them to \`.env.example\` (empty values for the secrets) and to the env schema if the repo has one. Fail loudly at request time if a server secret is missing.`;
}

function stepsIntro() {
  return `## Implementation

Adapt names and paths to the repository's conventions. The code below is complete and correct for the White Money API; replace only the parts marked as "your code" (database access).

### Step 1: order fields

Add to the order model (migration if the repo uses one):

- \`status\`: reuse the existing enum; you need at least \`pending\`, \`paid\`, and ideally \`partially_refunded\` and \`refunded\`.
- \`total\` as an exact amount (integer cents or a decimal). Whitechain amounts are decimal strings with at most 6 decimals, for example \`"49.99"\`.
- \`wcSessionId\` (string, nullable), \`wcPaymentId\`, \`wcTxHash\`, \`paidAt\`, \`amountRefunded\` (decimal string, default \`"0"\`).
- A processed webhook event store: a table \`processed_webhook_events(id text primary key)\`, or equivalent, so each \`evt_...\` is applied once.

### Step 2: server helper (no dependencies)

Create one server-only module. It talks to the API with \`fetch\` and verifies webhooks with \`node:crypto\`. It mirrors \`createCheckoutSession\` and \`verifyWebhook\` from \`@whitechain-commerce/react/server\`; if that package is installable in this repo you may import those instead, with the same behaviour.

${fence(
  "ts",
  `
// lib/whitechain.ts (server only: never import from browser code)
import { createHmac, timingSafeEqual } from "node:crypto";

export interface WcCheckoutSession {
  id: string; // cs_...
  url: string; // hosted checkout page
  status: "open" | "processing" | "paid" | "expired";
  orderId: string;
  amount: string; // "49.99"
  currency: "USDT";
  expiresAt: string; // ISO, 30 minutes after creation
  successUrl: string | null;
  cancelUrl: string | null;
  payment: { id: string; txHash: string; explorerUrl: string } | null;
  metadata: Record<string, string> | null;
  createdAt: string;
}

export interface WcPayment {
  id: string; // pay_... (pay_test_... for dashboard test events)
  sessionId: string;
  orderId: string; // your order id
  amount: string;
  amountRefunded: string;
  currency: "USDT";
  status: "succeeded" | "partially_refunded" | "refunded";
  payer: string;
  txHash: string;
  explorerUrl: string;
  chainId: 1874;
  chainPaymentId: string;
  createdAt: string;
}

export interface WcRefund {
  id: string; // re_...
  paymentId: string;
  orderId: string;
  amount: string;
  currency: "USDT";
  status: "pending" | "succeeded";
  txHash: string | null;
  explorerUrl: string | null;
  createdAt: string;
}

export type WcEvent =
  | { id: string; type: "payment.succeeded"; created: number; data: { payment: WcPayment } }
  | { id: string; type: "refund.succeeded"; created: number; data: { refund: WcRefund; payment: WcPayment } };

export class WhitechainError extends Error {
  status: number;
  type: string;
  constructor(message: string, status: number, type: string) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

export class WebhookSignatureError extends Error {}

function apiBase(): string {
  const base = process.env.WC_API_BASE;
  if (!base) throw new Error("WC_API_BASE is not set");
  return base.replace(/\\/+$/, "");
}

/**
 * POST /api/v1/checkout_sessions. Idempotent per orderId: an open session with the same amount is
 * returned again (200), otherwise a new one is created (201). An already-paid order is 409 conflict.
 */
export async function createCheckoutSession(input: {
  orderId: string; // your order id, max 200 chars
  amount: string; // decimal string, at most 6 decimals, computed on the server
  successUrl?: string; // http(s), max 2048 chars
  cancelUrl?: string;
  metadata?: Record<string, string>; // up to 20 keys; not included in webhooks
}): Promise<WcCheckoutSession> {
  const secretKey = process.env.WC_SECRET_KEY;
  if (!secretKey?.startsWith("sk_")) throw new Error("WC_SECRET_KEY is not set");
  if (!/^\\d+(\\.\\d{1,6})?$/.test(input.amount) || Number(input.amount) <= 0)
    throw new Error(\`Invalid amount \${JSON.stringify(input.amount)}\`);

  const res = await fetch(\`\${apiBase()}/api/v1/checkout_sessions\`, {
    method: "POST",
    headers: { Authorization: \`Bearer \${secretKey}\`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, currency: "USDT" }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Error format: { "error": { "type": "invalid_request" | "authentication" | "not_found" | "conflict" | "server_error", "message": "..." } }
    throw new WhitechainError(body?.error?.message ?? \`HTTP \${res.status}\`, res.status, body?.error?.type ?? "server_error");
  }
  return body as WcCheckoutSession;
}

/**
 * Verifies the WC-Signature header (t=<unix seconds>,v1=<hex HMAC-SHA256(secret, \`\${t}.\${rawBody}\`)>)
 * against the RAW request body, then parses it. Throws WebhookSignatureError.
 */
export function verifyWebhook(rawBody: string, header: string | null | undefined, secret: string, toleranceSeconds = 300): WcEvent {
  if (!header) throw new WebhookSignatureError("Missing WC-Signature header");
  const parts: Record<string, string> = {};
  for (const item of header.split(",")) {
    const i = item.indexOf("=");
    if (i > 0) parts[item.slice(0, i).trim()] = item.slice(i + 1).trim();
  }
  const t = Number(parts.t);
  if (!Number.isInteger(t) || t <= 0 || !parts.v1) throw new WebhookSignatureError("Malformed WC-Signature header");
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) throw new WebhookSignatureError("Timestamp outside tolerance");
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest();
  const received = Buffer.from(parts.v1, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected))
    throw new WebhookSignatureError("Signature mismatch");
  return JSON.parse(rawBody) as WcEvent;
}

/** "14.98" / "14.980000" -> 14980000n, so USDT amounts compare exactly (never compare floats). */
export function toMicro(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole || "0") * BigInt(1_000_000) + BigInt((frac + "000000").slice(0, 6));
}

/** Integer cents -> "49.99". */
export function centsToAmount(cents: number): string {
  return \`\${Math.floor(cents / 100)}.\${String(cents % 100).padStart(2, "0")}\`;
}
`,
)}`;
}

// ---------------------------------------------------------------------------------------------
// Next.js (App Router)

function nextSteps(mode: "widget" | "hosted") {
  const client =
    mode === "widget"
      ? `### Step 4: client checkout (embedded widget)

Install \`@whitechain-commerce/react\` only if it resolves (see Step 0). In this monorepo it is \`"@whitechain-commerce/react": "workspace:*"\`, and because it ships TypeScript source, add both packages to \`transpilePackages\` in \`next.config.ts\`:

${fence(
  "ts",
  `
// next.config.ts
const nextConfig = {
  transpilePackages: ["@whitechain-commerce/react", "@whitechain-commerce/core"],
};
export default nextConfig;
`,
)}

The checkout page loads the order on the server and renders a client component with the session id. Load the order in the page and redirect to the status page when it is no longer pending.

${fence(
  "tsx",
  `
// app/checkout/[orderId]/pay.tsx
"use client";

import { useRouter } from "next/navigation";
import { WhitechainCheckout } from "@whitechain-commerce/react";

export function Pay({ orderId, sessionId }: { orderId: string; sessionId: string }) {
  const router = useRouter();
  return (
    <WhitechainCheckout
      sessionId={sessionId}
      apiBase={process.env.NEXT_PUBLIC_WC_API_BASE}
      theme="light" // or "dark"
      // UI only. The order becomes paid when the signed webhook arrives, never here.
      onSuccess={() => router.push(\`/orders/\${orderId}\`)}
      onCancel={() => router.push("/")} // your code: the cart or product page the customer came from
      onError={(err) => console.error("Whitechain checkout error", err)}
    />
  );
}
`,
)}

The widget's only props are \`sessionId\`, \`apiBase\`, \`onSuccess\`, \`onError\`, \`onCancel\`, \`theme\` (\`"light" | "dark"\`) and \`className\`. It handles wallet connection, switching to chain 1874, balance checks, USDT approval and payment, and polls the session until it is \`paid\`. \`onSuccess\` receives \`{ sessionId, orderId, paymentId, txHash, explorerUrl, successUrl, alreadyPaid }\`.

If the widget cannot be installed, switch to the hosted flow: in the button handler, \`POST /api/checkout\` and then \`window.location.assign(url)\`.`
      : `### Step 4: client checkout (hosted page)

The "Pay with USDT" button posts to the server route, which creates the session and answers with its hosted \`url\`; then send the browser there:

${fence(
  "tsx",
  `
// components/pay-with-usdt.tsx
"use client";

import { useState } from "react";

export function PayWithUsdt({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }), // only the id: the server decides the amount
    });
    const body = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Could not start checkout");
      return;
    }
    window.location.assign(body.url); // {WC_API_BASE}/checkout/cs_...
  }
  return (
    <>
      <button onClick={pay} disabled={busy}>{busy ? "Redirecting…" : "Pay with USDT"}</button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
`,
)}

The hosted page redirects to \`successUrl\` about 2 seconds after the payment is confirmed and shows a cancel button linking to \`cancelUrl\`. \`?theme=dark\` on the URL switches to the dark theme. It adds no query parameters to your URLs, so put the order id in the path.`;

  return `### Step 3: server route that creates the session

The browser sends only an order id (or a cart of product ids and quantities). The server loads the order, computes or reads the total, and creates the session. Use **your order id as \`orderId\`**: retries and page reloads then return the same open session instead of creating a second payable one.

${fence(
  "ts",
  `
// app/api/checkout/route.ts
import { createCheckoutSession, WhitechainError, centsToAmount } from "@/lib/whitechain";
import { getOrderForCurrentUser, setOrderSession } from "@/lib/orders"; // your code

export async function POST(req: Request) {
  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
  const order = orderId ? await getOrderForCurrentUser(orderId) : null;
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "pending") return Response.json({ error: "Order is not awaiting payment" }, { status: 409 });

  const appUrl = process.env.APP_URL!; // or the repo's existing public URL variable
  try {
    const session = await createCheckoutSession({
      orderId: order.id,
      amount: centsToAmount(order.totalCents), // from YOUR database, never from the request
      successUrl: \`\${appUrl}/orders/\${order.id}\`,
      cancelUrl: \`\${appUrl}/\`, // your code: a real route, such as the cart or the product page
      metadata: { customerId: String(order.customerId) },
    });
    await setOrderSession(order.id, session.id);
    return Response.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    if (err instanceof WhitechainError && err.type === "conflict")
      return Response.json({ error: err.message }, { status: 409 }); // e.g. already paid, or payout wallet missing
    console.error("[checkout] createCheckoutSession failed", err);
    return Response.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
`,
)}

For the widget, the checkout page can also call \`createCheckoutSession\` directly in a Server Component and pass \`session.id\` to the client component; it is safe to call on every render because of the \`orderId\` idempotency.

${client}

### Step 5: webhook route (the only place an order becomes paid)

${fence(
  "ts",
  `
// app/api/webhooks/whitechain/route.ts
// Runs on the Node.js runtime (the default). Do not set runtime = "edge": verification uses node:crypto.
import { verifyWebhook, WebhookSignatureError, toMicro, centsToAmount, type WcEvent } from "@/lib/whitechain";
import { db } from "@/lib/db"; // your code

export async function POST(req: Request) {
  const secret = process.env.WC_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "WC_WEBHOOK_SECRET is not set" }, { status: 500 }); // 5xx: retried later

  const rawBody = await req.text(); // raw bytes: never JSON.parse + re-stringify before verifying
  let event: WcEvent;
  try {
    event = verifyWebhook(rawBody, req.headers.get("wc-signature"), secret);
  } catch (err) {
    if (err instanceof WebhookSignatureError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }

  // Only these two types exist today. Acknowledge anything newer (2xx) instead of crashing on it.
  if ((event.type !== "payment.succeeded" && event.type !== "refund.succeeded") || !event.data?.payment)
    return Response.json({ received: true, ignored: true });

  // Dashboard / send_test_webhook events: verified, but never fulfil them.
  if (event.data.payment.id.startsWith("pay_test_")) return Response.json({ received: true, test: true });

  // Apply each event once, atomically with the order update (your code: a transaction + unique key).
  await db.transaction(async (tx) => {
    const inserted = await tx.insertProcessedEvent(event.id); // INSERT ... ON CONFLICT DO NOTHING; false if it existed
    if (!inserted) return;

    const payment = event.data.payment;
    const order = await tx.getOrder(payment.orderId);
    if (!order) return; // unknown order: acknowledge with 2xx so it is not retried

    if (event.type === "payment.succeeded") {
      if (toMicro(payment.amount) !== toMicro(centsToAmount(order.totalCents))) {
        console.error(\`[webhook] amount mismatch for \${order.id}: paid \${payment.amount}\`);
        return; // do not fulfil; flag for manual review
      }
      if (order.status === "pending") {
        await tx.markOrderPaid(order.id, { paymentId: payment.id, txHash: payment.txHash, paidAt: new Date() });
        await tx.enqueueFulfilment(order.id); // existing fulfilment: emails, shipping... keep the handler fast
      }
    } else if (event.type === "refund.succeeded") {
      // Events can arrive out of order: treat payment.amountRefunded/status as a running total, never move backwards.
      if (toMicro(payment.amountRefunded) > toMicro(order.amountRefunded ?? "0"))
        await tx.setOrderRefund(order.id, {
          amountRefunded: payment.amountRefunded,
          status: payment.status === "refunded" ? "refunded" : "partially_refunded",
        });
    }
  });

  return Response.json({ received: true });
}
`,
)}

Rules this handler encodes: respond within 10 seconds; any non-2xx is retried (after 1, 5 and 30 minutes), so return \`400\` for a bad signature, \`5xx\` for your own temporary failures, and \`2xx\` for events you choose to ignore. Make sure no middleware or auth/session proxy (\`middleware.ts\`/\`proxy.ts\`, CSRF, login redirects) intercepts \`/api/webhooks/whitechain\`: a \`3xx\` counts as a failure.

### Step 6: order status page

After paying, the customer lands on \`/orders/{id}\` before or after the webhook arrives. Show the order's status from **your** database and poll until it is paid:

${fence(
  "ts",
  `
// app/api/orders/[id]/route.ts
import { getOrderForCurrentUser } from "@/lib/orders"; // your code

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderForCurrentUser(id);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ id: order.id, status: order.status }, { headers: { "Cache-Control": "no-store" } });
}
`,
)}

${fence(
  "tsx",
  `
// app/orders/[id]/order-status.tsx
"use client";

import { useEffect, useState } from "react";

export function OrderStatus({ orderId, initialStatus }: { orderId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  useEffect(() => {
    if (status !== "pending") return;
    let tries = 0;
    const timer = setInterval(async () => {
      if (++tries > 90) return clearInterval(timer); // stop after ~3 minutes
      const res = await fetch(\`/api/orders/\${orderId}\`, { cache: "no-store" });
      if (res.ok) setStatus((await res.json()).status);
    }, 2000);
    return () => clearInterval(timer);
  }, [orderId, status]);

  if (status === "pending") return <p>Confirming your payment on Whitechain…</p>;
  if (status === "paid") return <p>Payment received. Thank you!</p>;
  return <p>Order status: {status}</p>;
}
`,
)}

The page itself (\`app/orders/[id]/page.tsx\`) loads the order on the server and renders \`<OrderStatus orderId initialStatus />\`. It must render per request: if \`next.config\` sets \`cacheComponents: true\` (new Next.js 16 apps do), call \`await connection()\` from \`next/server\` before reading the database and wrap the part that reads it in \`<Suspense>\`; otherwise \`next build\` fails on uncached data, or the page is frozen at build time.`;
}

// ---------------------------------------------------------------------------------------------
// Express-style Node backends (react-node, node, other)

function expressSteps(stack: IntegrationStack, mode: "widget" | "hosted") {
  const server = `### Step 3: server routes (Express shown; adapt to the repo's framework)

Register the webhook route **before** any global JSON body parser, with a raw body parser, because the signature covers the exact bytes.

${fence(
  "ts",
  `
// server/whitechain-routes.ts
import express from "express";
import { createCheckoutSession, verifyWebhook, WebhookSignatureError, WhitechainError, toMicro, centsToAmount } from "./lib/whitechain";
import { db, getOrderForUser, setOrderSession } from "./orders"; // your code

export function mountWhitechain(app: express.Express) {
  // 1. Webhook: raw body, BEFORE app.use(express.json()).
  app.post("/api/webhooks/whitechain", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
    const secret = process.env.WC_WEBHOOK_SECRET;
    if (!secret) return res.status(500).json({ error: "WC_WEBHOOK_SECRET is not set" }); // retried later

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    let event;
    try {
      event = verifyWebhook(rawBody, req.get("wc-signature"), secret);
    } catch (err) {
      if (err instanceof WebhookSignatureError) return res.status(400).json({ error: err.message });
      throw err;
    }

    // Only these two types exist today. Acknowledge anything newer (2xx) instead of crashing on it.
    if ((event.type !== "payment.succeeded" && event.type !== "refund.succeeded") || !event.data?.payment)
      return res.json({ received: true, ignored: true });

    const payment = event.data.payment;
    if (payment.id.startsWith("pay_test_")) return res.json({ received: true, test: true }); // never fulfil test events

    await db.transaction(async (tx) => {
      if (!(await tx.insertProcessedEvent(event.id))) return; // already applied (unique key on event id)
      const order = await tx.getOrder(payment.orderId);
      if (!order) return; // unknown order: still 2xx

      if (event.type === "payment.succeeded") {
        if (toMicro(payment.amount) !== toMicro(centsToAmount(order.totalCents))) return; // amount mismatch: flag, don't fulfil
        if (order.status === "pending") {
          await tx.markOrderPaid(order.id, { paymentId: payment.id, txHash: payment.txHash, paidAt: new Date() });
          await tx.enqueueFulfilment(order.id);
        }
      } else if (event.type === "refund.succeeded") {
        if (toMicro(payment.amountRefunded) > toMicro(order.amountRefunded ?? "0"))
          await tx.setOrderRefund(order.id, {
            amountRefunded: payment.amountRefunded,
            status: payment.status === "refunded" ? "refunded" : "partially_refunded",
          });
      }
    });
    res.json({ received: true });
  });

  // 2. Everything else can use JSON.
  app.use(express.json());

  // Create (or reuse) the session for an order. The client sends only the order id.
  app.post("/api/checkout", async (req, res) => {
    const order = await getOrderForUser(req, req.body?.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending") return res.status(409).json({ error: "Order is not awaiting payment" });
    try {
      const session = await createCheckoutSession({
        orderId: order.id, // idempotency key
        amount: centsToAmount(order.totalCents), // from your database
        successUrl: \`\${process.env.APP_URL}/orders/\${order.id}\`,
        cancelUrl: \`\${process.env.APP_URL}/\`, // a real route: the cart or product page
      });
      await setOrderSession(order.id, session.id);
      res.json({ sessionId: session.id, url: session.url });
    } catch (err) {
      if (err instanceof WhitechainError && err.type === "conflict") return res.status(409).json({ error: err.message });
      console.error("[checkout] createCheckoutSession failed", err);
      res.status(502).json({ error: "Could not start checkout" });
    }
  });

  // Order status for the status page (from YOUR database).
  app.get("/api/orders/:id", async (req, res) => {
    const order = await getOrderForUser(req, req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.set("Cache-Control", "no-store").json({ id: order.id, status: order.status });
  });
}
`,
)}

If the app has a global \`express.json()\` registered earlier (often in \`app.ts\`/\`server.ts\`), move the webhook route above it or exclude the path: \`app.use((req, res, next) => req.path === "/api/webhooks/whitechain" ? next() : express.json()(req, res, next))\`. The handler must respond within 10 seconds; any non-2xx is retried after 1, 5 and 30 minutes, and \`3xx\` counts as a failure, so keep auth/CSRF middleware off this path.

Hosted-only redirect variant (plain HTML form, no client JavaScript):

${fence(
  "ts",
  `
app.post("/checkout/:orderId", async (req, res) => {
  const order = await getOrderForUser(req, req.params.orderId);
  if (!order || order.status !== "pending") return res.redirect(303, \`/orders/\${req.params.orderId}\`);
  const session = await createCheckoutSession({
    orderId: order.id,
    amount: centsToAmount(order.totalCents),
    successUrl: \`\${process.env.APP_URL}/orders/\${order.id}\`,
    cancelUrl: \`\${process.env.APP_URL}/\`,
  });
  res.redirect(303, session.url); // the hosted checkout page
});
`,
)}`;

  const reactClient =
    mode === "widget"
      ? `### Step 4: client checkout (embedded widget, React)

Only if \`@whitechain-commerce/react\` resolves (see Step 0); it ships TypeScript source, so the bundler must compile it (Vite does by default for linked workspace packages). Pass \`apiBase\` explicitly: outside Next.js the widget cannot read env vars.

${fence(
  "tsx",
  `
// src/checkout/Pay.tsx
import { useEffect, useState } from "react";
import { WhitechainCheckout } from "@whitechain-commerce/react";

export function Pay({ orderId }: { orderId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }), // the server decides the amount
    })
      .then(async (r) => (r.ok ? setSessionId((await r.json()).sessionId) : setError((await r.json()).error)))
      .catch(() => setError("Could not start checkout"));
  }, [orderId]);

  if (error) return <p role="alert">{error}</p>;
  if (!sessionId) return <p>Loading checkout…</p>;
  return (
    <WhitechainCheckout
      sessionId={sessionId}
      apiBase={import.meta.env.VITE_WC_API_BASE}
      onSuccess={() => window.location.assign(\`/orders/\${orderId}\`)} // UI only; the webhook fulfils
      onCancel={() => window.location.assign("/")} // your code: the cart or product page
      onError={(err) => console.error("Whitechain checkout error", err)}
    />
  );
}
`,
)}

The widget's only props are \`sessionId\`, \`apiBase\`, \`onSuccess\`, \`onError\`, \`onCancel\`, \`theme\` (\`"light" | "dark"\`) and \`className\`. Creating the session twice (React strict mode runs effects twice in development) is harmless: the same \`orderId\` and amount return the same open session.

If the widget cannot be installed, use hosted checkout: \`POST /api/checkout\`, then \`window.location.assign(url)\`.`
      : `### Step 4: client checkout (hosted page)

The pay button calls \`POST /api/checkout\` with the order id and then sends the browser to the returned \`url\`, or use the plain-form redirect variant above:

${fence(
  "ts",
  `
async function payWithUsdt(orderId: string) {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }), // only the id: the server decides the amount
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Could not start checkout");
  window.location.assign(body.url); // hosted checkout on the White Money domain
}
`,
)}

The hosted page redirects to \`successUrl\` about 2 seconds after the payment is confirmed and shows a cancel button linking to \`cancelUrl\`. Append \`?theme=dark\` to the URL for the dark theme. It adds no query parameters to your URLs, so put the order id in the path.`;

  const status = `### Step 5: order status page

\`successUrl\` points at the order page. It must read the order status from your database (\`GET /api/orders/:id\` above) and, while it is \`pending\`, show "Confirming your payment on Whitechain…" and poll every 2 seconds (stop after a few minutes). Reaching \`successUrl\` is not proof of payment: anyone can open it. Only the webhook changes the status.${stack === "react-node" ? "\n\nIn the React frontend, a `useEffect` with `setInterval` polling `/api/orders/${orderId}` until `status !== \"pending\"` is enough." : ""}`;

  return [server, reactClient, status].join("\n\n");
}

function otherStackNotes() {
  return `### Notes for other frameworks

The flow is the same everywhere: one server endpoint creates the session (\`POST {WC_API_BASE}/api/v1/checkout_sessions\` with \`Authorization: Bearer $WC_SECRET_KEY\` and JSON \`{ "orderId", "amount", "currency": "USDT", "successUrl", "cancelUrl", "metadata" }\`, response \`{ id, url, status, ... }\`), the customer is redirected to \`url\`, and one webhook endpoint verifies \`WC-Signature\` on the raw body. Get the raw body like this:

| Framework | Raw body for the webhook |
| --- | --- |
| Next.js App Router | \`await req.text()\` (see \`?stack=nextjs\`) |
| Next.js Pages Router | \`export const config = { api: { bodyParser: false } }\` and read the stream into a Buffer |
| Express | \`express.raw({ type: "*/*" })\` on the route, before \`express.json()\` |
| Fastify | \`app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => done(null, body))\` in a plugin scoped to the webhook route |
| NestJS | \`NestFactory.create(AppModule, { rawBody: true })\`, then \`req.rawBody\` |
| Hono / Remix / SvelteKit / Astro | \`await request.text()\` (Hono: \`await c.req.text()\`) |
| Django | \`request.body\` (exempt the view from CSRF) |
| Flask | \`request.get_data()\` |
| Rails | \`request.raw_post\` (skip CSRF verification for the action) |
| Laravel | \`$request->getContent()\` (exclude the route from CSRF) |
| Go | \`io.ReadAll(r.Body)\` |

Signature recipe for non-Node languages: header \`WC-Signature: t=<unix seconds>,v1=<hex>\`; split on \`,\` then on the first \`=\`; reject if \`|now - t| > 300\`; compute HMAC-SHA256 with the full \`whsec_...\` secret as UTF-8 key over the string \`"<t>.<raw body>"\`; compare lowercase hex to \`v1\` in constant time (\`hmac.compare_digest\`, \`ActiveSupport::SecurityUtils.secure_compare\`, \`hash_equals\`, \`hmac.Equal\`); only then parse JSON. Test vector: secret \`whsec_exampleexampleexampleexample1234\`, \`t = 1793975348\`, body \`{"id":"evt_example","type":"payment.succeeded"}\` gives \`v1=2969cd7b4e1840f6a11ae5a59ef36e6bbc7ee626bfc3411ad8dd049e3426983e\`. Add a unit test with this vector (use a tolerance large enough for the fixed timestamp).

The embedded widget is React only; on non-React frontends use the hosted checkout.`;
}

// ---------------------------------------------------------------------------------------------

function securitySection() {
  return `## Security rules (do not break these)

1. **The secret key is server-only.** \`WC_SECRET_KEY\` is read only in server code, never shipped to the browser, never logged, never committed. No \`NEXT_PUBLIC_\`/\`VITE_\` prefix. Only the API base URL may be public.
2. **Never trust the client's amount.** The browser sends an order id or product ids and quantities; the server computes the total from its own data and passes it as \`amount\`. Do not accept \`amount\` from the request body.
3. **Use your order id as \`orderId\`.** It is the idempotency key: one session pays one order, a paid order cannot get a new session (\`409 conflict\`), and retries return the same open session. If the cart changes, create a new order (new id) rather than reusing the old one with a different amount.
4. **Verify the webhook before doing anything.** Verify \`WC-Signature\` on the raw body with \`WC_WEBHOOK_SECRET\` before parsing or trusting it; reject failures with \`400\`. Keep the route on a Node.js runtime (not Edge) if it uses \`node:crypto\`.
5. **Fulfil only from the verified \`payment.succeeded\` webhook.** Not from the widget's \`onSuccess\`, not from reaching \`successUrl\`, not from a client-side session status. Check \`payment.orderId\` belongs to a pending order and \`payment.amount\` equals the order total exactly (compare in micro-units, not floats).
6. **Be idempotent.** Deliveries are at least once and can be redelivered: dedupe on \`event.id\` with a unique key, in the same transaction as the order update. Don't assume ordering between \`payment.succeeded\` and \`refund.succeeded\`.
7. **Ignore test events.** A payment whose \`id\` starts with \`pay_test_\` is a signed test (\`orderId\` \`test_order\`); return \`2xx\` and fulfil nothing.
8. **Refunds need the merchant's wallet.** A refund created in the dashboard, with \`POST /api/v1/refunds\` or the \`create_refund\` tool stays \`pending\` until the merchant signs it with their payout wallet in the dashboard. Do not build code that holds a private key or tries to sign refunds; do not mark an order refunded until \`refund.succeeded\` arrives.
9. **Don't let middleware break the webhook.** No auth redirects, CSRF checks, body parsers or trailing-slash redirects on the webhook path.`;
}

function testingSection(base: string) {
  return `## Test on testnet


1. **Unit-test signature verification** with the test vector: secret \`whsec_exampleexampleexampleexample1234\`, \`t = 1793975348\`, raw body \`{"id":"evt_example","type":"payment.succeeded"}\` must verify as \`v1=2969cd7b4e1840f6a11ae5a59ef36e6bbc7ee626bfc3411ad8dd049e3426983e\` (pass a large tolerance or a fixed "now"), and fail for a changed body or secret. Use the repo's test runner; if it has none, a \`node --test\` file (for example \`test/whitechain.test.mjs\`, run from an \`npm test\` script) is enough.
2. **Make the webhook reachable.** The platform must be able to POST to the URL. Against a hosted dashboard such as \`${base}\`, local URLs (\`localhost\`, private IPs) are rejected, so expose the dev server through a public HTTPS tunnel (for example \`cloudflared tunnel --url http://localhost:3000\` or \`ngrok http 3000\`) and register \`https://<tunnel>/api/webhooks/whitechain\`.
3. **Send a test event**: \`send_test_webhook\` (MCP) or **Webhooks → Send test event** in the dashboard. Expect a \`2xx\` and no order change (it is a \`pay_test_\` payment for \`test_order\`). A \`400\` means the secret or raw-body handling is wrong.
4. **Create a session** from the app's checkout, or directly:
${fence(
  "bash",
  `
curl -X POST ${base}/api/v1/checkout_sessions \\
  -H "Authorization: Bearer $WC_SECRET_KEY" -H "Content-Type: application/json" \\
  -d '{"orderId":"order_123","amount":"1.00","successUrl":"http://localhost:3000/orders/order_123"}'
`,
)}
   Calling it twice with the same body must return the same \`id\` (\`200\` the second time, \`201\` the first).
5. **Pay it** with a browser wallet (MetaMask or any EIP-1193 wallet) on chain 1874: RPC \`https://rpc.testnet.whitechain.io\`, explorer https://explorer.testnet.whitechain.io. The customer needs **WBT** for gas (faucet: https://faucet.testnet.whitechain.io) and **testnet USDT** at \`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7\` (6 decimals; add it as a custom token). The human has to do this step; you cannot sign wallet transactions. If no funded wallet is available, say so and stop at step 4.
6. **Check the result**: the order page flips from "Confirming…" to paid within a few seconds of the webhook; \`get_checkout_session\` / \`list_payments\` (MCP) or **Payments** in the dashboard show the payment; the delivery shows as delivered under **Webhooks**. Redeliver it from the dashboard and confirm the order is not fulfilled twice.
7. **Refunds** (optional): refund part of the payment from the dashboard payment page (signed with the payout wallet) and check that \`refund.succeeded\` updates \`amountRefunded\` and the status.

More: ${base}/docs/testing.`;
}

function checklistSection(mode: "widget" | "hosted") {
  return `## Final checklist (verify each item before saying you are done)

- [ ] \`WC_SECRET_KEY\`, \`WC_WEBHOOK_SECRET\` and \`WC_API_BASE\`${mode === "widget" ? " (and the public API base for the widget)" : ""} are read from env, documented in \`.env.example\` with empty secret values, and no secret is committed. \`git grep -n "sk_test_\\|whsec_"\` finds no real keys.
- [ ] The secret key is only referenced from server code; no browser bundle imports the server helper.
- [ ] The session is created on the server with \`orderId\` = the merchant's order id and an \`amount\` computed from server-side data. The request body is never the source of the amount.
- [ ] Customers can reach the payment UI: ${mode === "widget" ? "`<WhitechainCheckout sessionId apiBase onSuccess />` renders with an explicit `apiBase`" : "the pay button redirects to `session.url`"}, and \`successUrl\`/\`cancelUrl\` point at real routes.
- [ ] The webhook route reads the raw body, verifies \`WC-Signature\` with \`WC_WEBHOOK_SECRET\` before parsing, returns \`400\` on failure and \`500\` if the secret is missing, and is not intercepted by middleware.
- [ ] \`payment.succeeded\` marks the order paid only if \`payment.amount\` equals the order total, exactly once per \`event.id\` (unique key, same transaction), and ignores \`pay_test_\` payments and unknown orders with a \`2xx\`.
- [ ] \`refund.succeeded\` updates the refunded amount/status without ever moving it backwards.
- [ ] Fulfilment is not triggered from \`onSuccess\`, \`successUrl\` or any client signal.
- [ ] The order status page reads from the merchant's database and polls while pending.
- [ ] Signature verification has a unit test with the documented test vector, and the repo's typecheck, lint and tests pass.
- [ ] A test webhook (\`send_test_webhook\` or the dashboard) returned \`2xx\`, or you told the human exactly how to run it.
- [ ] You told the human what is left for them: dashboard account and payout wallet, secret key, webhook endpoint registration, a funded testnet wallet for an end-to-end payment.`;
}

function referenceSection(base: string) {
  return `## Reference

- \`POST /api/v1/checkout_sessions\` (secret key): body \`{ orderId (1-200 chars), amount ("49.99", ≤ 6 decimals), currency?: "USDT", successUrl?, cancelUrl?, metadata? (≤ 20 string pairs) }\` → \`201\` new / \`200\` existing session \`{ id, url, status, orderId, amount, amountUnits, currency, decimals, chainId, expiresAt, successUrl, cancelUrl, payment, metadata, createdAt, ... }\`. Sessions expire 30 minutes after creation.
- \`GET /api/v1/checkout_sessions/{id}\` (public, no key): status \`open | processing | paid | expired\`, used by the widget. Display only; do not fulfil from it.
- Webhook event: \`{ id: "evt_...", type: "payment.succeeded" | "refund.succeeded", created, data: { payment } | { refund, payment } }\`, header \`WC-Signature: t=...,v1=...\`, \`Content-Type: application/json\`, \`User-Agent: WhitechainCommerce-Webhooks/1.0\`.
- Errors: \`{ "error": { "type", "message" } }\` with \`invalid_request\` 400, \`authentication\` 401, \`not_found\` 404, \`conflict\` 409, \`server_error\` 500.
- Docs: ${base}/docs/quickstart, ${base}/docs/checkout-sessions, ${base}/docs/checkout-widget, ${base}/docs/hosted-checkout, ${base}/docs/webhooks, ${base}/docs/api-reference, ${base}/docs/errors, ${base}/docs/testing, ${base}/docs/agents.`;
}

// ---------------------------------------------------------------------------------------------

function paymentLinkGuide(base: string) {
  return `# Add a White Money payment link (instructions for coding agents)

You are a coding agent working inside a merchant's repository. The goal is a no-code USDT payment: a fixed-price **payment link** behind a button. No server code, keys or webhooks are needed in the repository.

White Money is a non-custodial USDT checkout. A payment link is a reusable URL \`${base}/pay/pl_...\`; every visit opens a fresh hosted checkout for the link's fixed amount, and the customer pays from their wallet straight to the merchant's payout wallet.

## Choose this only if

- The price is fixed (a product, a ticket, a donation tier, an invoice amount) and the site does not need to know which visitor paid.
- If the repo has orders or carts with variable totals, or must fulfil automatically, use the full integration instead: \`${base}/integrate.md?mode=hosted\` (or \`?stack=nextjs\`).

## Steps

1. **Get the link.**
   - If the \`whitechain\` MCP server is connected: call \`get_account\` and check \`canAcceptPayments\` is \`true\` (otherwise tell the human to finish setup at ${base}/dashboard/setup), then \`create_payment_link\` with the name and amount (a decimal string such as \`"25.00"\`). It returns the link \`url\`. \`list_payment_links\` shows existing ones; reuse a matching active link instead of creating a duplicate.
   - Otherwise ask the human to create it under **Payment links** at ${base}/dashboard/links and give you the URL.
2. **Put the URL behind a button** where the human asked for it, using the repo's existing button/link component and styles:
${fence(
  "html",
  `
<a href="${base}/pay/pl_XXXXXXXX" target="_blank" rel="noopener">Pay 25 USDT</a>
`,
)}
   Store the URL in a config constant or a public env var (for example \`NEXT_PUBLIC_WC_PAYMENT_LINK_URL\`) rather than scattering it. It is not a secret.
3. **Tell the human** how payments show up: in the dashboard under **Payments** and on the link's row (count and total). If they later add a webhook endpoint, link payments arrive as normal \`payment.succeeded\` events whose \`orderId\` starts with the link id (\`pl_..._...\`).

## Checklist

- [ ] The button opens the link URL and the link is active (\`list_payment_links\` or the dashboard).
- [ ] No secret key was added to the repository.
- [ ] The human knows payments need a wallet with WBT for gas (faucet: https://faucet.testnet.whitechain.io) and testnet USDT (\`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7\`). See ${base}/docs/testing.
`;
}
