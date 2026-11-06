# Quickstart

Take your first testnet USDT payment end to end: account, payout wallet, API key, checkout session, widget, webhook.

This guide takes about 10 minutes. The code samples use Next.js (App Router) and TypeScript, the same stack as the sample store in `apps/demo-store`. Read the [introduction](./introduction.md) first if you want the concepts behind each step.

## Before you start

You need:

- A running Whitechain Commerce dashboard and worker. Locally that is `http://localhost:3000` (the `APP_URL` default). See [Self-hosting](./self-hosting.md) for the full setup. The short version, from the repo root:

  ```bash
  pnpm i
  cp .env.example .env    # then set at least WHITECHAIN_RPC_URL and DEPLOYER_PRIVATE_KEY
  pnpm db:up              # Postgres on :5433
  pnpm db:push            # create the schema
  pnpm dev                # dashboard on :3000, demo store on :3001
  pnpm worker             # in another terminal: indexer and webhook delivery every 4 s
  ```

  `DEPLOYER_PRIVATE_KEY` must be the owner of the `PaymentRouter` you point at, because only the owner can register payout wallets. Without the worker (or calls to `GET /api/cron/tick` with `Authorization: Bearer $CRON_SECRET`), payment and refund webhooks are never delivered. Only **Send test event** delivers straight away.

- A browser wallet (any EIP-6963 or injected EIP-1193 wallet, such as MetaMask) for your payout wallet.
- A second wallet for the test customer, with some WBT for gas and some testnet USDT. See [Test with testnet USDT](#7-test-with-testnet-usdt).

## 1. Create an account

Open http://localhost:3000/signup and enter a business name (2 to 80 characters), an email and a password (at least 8 characters). Customers see the business name at checkout.

You land on the dashboard home page, which shows an onboarding checklist. On testnet the World ID step shows **Skipped on testnet** and your account is `active` straight away. If that step says **World ID verification is coming soon** and the payout step says it unlocks once your account is verified, World ID skipping is turned off on this deployment (see [Limitations](./introduction.md#limitations)).

## 2. Set a payout wallet

Payments settle directly to this wallet, and refunds are sent from it.

1. In the checklist step **Connect your payout wallet** (or **Settings**), connect your browser wallet, or enter an address by hand.
2. Choose **Use as payout wallet**.

What happens onchain: the platform's backend signer, which owns the `PaymentRouter`, sends `registerMerchant(merchantId, payout)` where `merchantId = keccak256(utf8("mer_..."))`. The dashboard waits for the transaction receipt and then shows **Payout wallet registered onchain** with a link to the transaction. You don't pay gas for this.

You can change the payout wallet later in **Settings**. Changes are limited to once every 5 minutes per merchant. Checkout sessions can't be created until a payout wallet is registered.

## 3. Create an API key

1. In the checklist step **Create an API key**, or on the **Developers** page, choose **Create secret key**.
2. Give it a name (optional) and choose **Create key**.
3. Copy the key. It looks like `sk_test_` followed by 32 characters. It is shown once; only its hash is stored.

Keep the key on your server. Put it, and the API base URL, in your store's environment:

```bash
WC_API_BASE=http://localhost:3000
WC_SECRET_KEY=sk_test_...
# Used by the checkout widget in the browser. Defaults the widget's apiBase.
NEXT_PUBLIC_WC_API_BASE=http://localhost:3000
```

## 4. Create a checkout session from your server

A checkout session prices one order. Always compute the amount on your server: the browser only ever gets the session id.

### With curl

```bash
curl -X POST http://localhost:3000/api/v1/checkout_sessions \
  -H "Authorization: Bearer $WC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "amount": "4.99",
    "currency": "USDT",
    "successUrl": "http://localhost:3001/orders/order_123",
    "cancelUrl": "http://localhost:3001/",
    "metadata": { "productId": "masala-chai" }
  }'
```

The response is a checkout session (`201 Created`):

```json
{
  "id": "cs_8fJ2kQ0LmZr4TbX1aYc9",
  "status": "open",
  "merchant": { "name": "Chai & Co." },
  "orderId": "order_123",
  "amount": "4.99",
  "amountUnits": "4990000",
  "currency": "USDT",
  "decimals": 6,
  "chainId": 1874,
  "routerAddress": "0xa99a6D97607567f4fe734831910D24f4e9BD0508",
  "tokenAddress": "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  "chainMerchantId": "0x…",
  "chainOrderId": "0x…",
  "expiresAt": "2026-11-06T12:30:00.000Z",
  "successUrl": "http://localhost:3001/orders/order_123",
  "cancelUrl": "http://localhost:3001/",
  "payment": null,
  "url": "http://localhost:3000/checkout/cs_8fJ2kQ0LmZr4TbX1aYc9",
  "metadata": { "productId": "masala-chai" },
  "createdAt": "2026-11-06T12:00:00.000Z"
}
```

The session expires 30 minutes after it is created. Creating a session is idempotent per `orderId`: if you call it again with the same `orderId` and amount while a session is still `processing`, or `open` and not yet past `expiresAt`, you get that same session back with `200 OK`. If the order is already paid, you get a `409` with type `conflict`. See [Checkout sessions](./checkout-sessions.md) for every rule and field.

To skip the widget entirely, redirect the customer to `url`. That is the [hosted checkout](./hosted-checkout.md).

### With Node

`createCheckoutSession` from `@whitechain-commerce/react/server` sends the same request. The examples below use a tiny in-memory order store so they run as is. Use your own database in production.

```ts
// lib/orders.ts
export type Order = {
  id: string;
  amount: string; // "4.99"
  status: "pending" | "paid" | "partially_refunded" | "refunded";
  sessionId: string | null;
  paymentId: string | null;
  amountRefunded: string;
};

// Kept on globalThis so every route handler in the same Node process sees the same data.
const g = globalThis as unknown as { orders?: Map<string, Order>; processedEvents?: Set<string> };
export const orders = (g.orders ??= new Map<string, Order>());
export const processedEvents = (g.processedEvents ??= new Set<string>());
```

Here is a Next.js route handler that prices the order from a server-side price list and creates the session:

```ts
// app/api/checkout/route.ts
import { createCheckoutSession, WhitechainApiError } from "@whitechain-commerce/react/server";
import { orders } from "@/lib/orders";

// Prices live on the server. Never accept an amount from the browser.
const PRICES: Record<string, string> = { "masala-chai": "4.99" };

export async function POST(req: Request) {
  const { productId } = (await req.json()) as { productId?: string };
  const amount = productId ? PRICES[productId] : undefined;
  if (!productId || !amount) return Response.json({ error: "Unknown product" }, { status: 400 });

  const orderId = `order_${crypto.randomUUID()}`;
  orders.set(orderId, { id: orderId, amount, status: "pending", sessionId: null, paymentId: null, amountRefunded: "0.00" });

  try {
    const session = await createCheckoutSession({
      apiBase: process.env.WC_API_BASE, // "http://localhost:3000"
      secretKey: process.env.WC_SECRET_KEY!,
      orderId,
      amount, // decimal string, at most 6 decimals
      successUrl: `http://localhost:3001/orders/${orderId}`,
      cancelUrl: "http://localhost:3001/",
      metadata: { productId },
    });
    orders.get(orderId)!.sessionId = session.id;
    return Response.json({ orderId, sessionId: session.id }, { status: 201 });
  } catch (err) {
    if (err instanceof WhitechainApiError) {
      // err.status is the HTTP status (0 for a local validation or network error); err.type is the error type.
      return Response.json({ error: err.message, type: err.type }, { status: 502 });
    }
    throw err;
  }
}
```

`createCheckoutSession` throws a `WhitechainApiError` before sending anything if the key doesn't start with `sk_`, `orderId` is empty, the amount isn't a positive decimal string with at most 6 decimals, or no API base is set (pass `apiBase` or set `NEXT_PUBLIC_WC_API_BASE`). It always sends `currency: "USDT"`.

### Install the SDK

The SDK packages, `@whitechain-commerce/react` and `@whitechain-commerce/core`, are workspace packages in this monorepo and are not published to npm. Inside the monorepo, add the dependency the way `apps/demo-store` does:

```json
{
  "dependencies": {
    "@whitechain-commerce/react": "workspace:*"
  }
}
```

The packages ship TypeScript source, so tell Next.js to compile them:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@whitechain-commerce/react", "@whitechain-commerce/core"],
};

export default nextConfig;
```

The React package needs `react` and `react-dom` 18 or later.

## 5. Render the checkout widget

Pass the session id to `<WhitechainCheckout />`. This is the whole client integration, the same as `apps/demo-store/src/app/checkout/[orderId]/pay.tsx`:

```tsx
// app/checkout/[orderId]/pay.tsx
"use client";

import { useRouter } from "next/navigation";
import { WhitechainCheckout } from "@whitechain-commerce/react";

export function Pay({ orderId, sessionId }: { orderId: string; sessionId: string }) {
  const router = useRouter();

  return (
    <WhitechainCheckout
      sessionId={sessionId}
      apiBase={process.env.NEXT_PUBLIC_WC_API_BASE ?? "http://localhost:3000"}
      // UX only: send the shopper to their order page. Fulfilment happens
      // server-side when the signed payment.succeeded webhook arrives.
      onSuccess={() => router.push(`/orders/${orderId}?paid=1`)}
      onError={(e) => console.error("Checkout error", e)}
    />
  );
}
```

Render `<Pay />` from a server component that loads the order and its `sessionId`. The widget then:

1. Loads the session from `GET /api/v1/checkout_sessions/{id}` (public, no key).
2. Lets the customer pick a wallet. If the wallet is on another network, it shows a **Switch network** button that switches to Whitechain Sepolia and adds the network if the wallet doesn't know it.
3. Shows the customer's USDT balance, and warns if the USDT balance is below the amount or the WBT balance is zero.
4. Sends `approve(router, amount)` if the current allowance is too low (first resetting a non-zero allowance to 0 if the token rejects the change), then `pay(chainMerchantId, chainOrderId, amountUnits)`.
5. Reports the transaction hash to `/submit` and polls the session until the backend marks it `paid`.
6. Calls `onSuccess` once.

The widget has its own styles, so your app doesn't need Tailwind. Other props: `onCancel`, `theme` (`"light"` or `"dark"`) and `className`. If you don't pass `onCancel`, the Cancel button goes to the session's `cancelUrl`. See [Checkout widget](./checkout-widget.md).

## 6. Add a webhook endpoint and fulfil orders from it

`onSuccess` runs in the customer's browser, so anyone can fake it. Fulfil orders only from a verified `payment.succeeded` webhook.

### Add the endpoint

1. In the dashboard, open **Webhooks** (or the checklist step **Add a webhook endpoint**).
2. Enter your endpoint URL, for example `http://localhost:3001/api/webhooks/whitechain`. Outside production, or with `ALLOW_PRIVATE_WEBHOOK_URLS=true`, `localhost` and private addresses are allowed. Otherwise the URL must resolve to a public address.
3. On the endpoint card, choose **Reveal** under **Signing secret** and copy it. It starts with `whsec_`.

Add the secret to your store's environment and restart the store:

```bash
WC_WEBHOOK_SECRET=whsec_...
```

### Verify the signature and fulfil

Every webhook is a `POST` with a JSON body and a `WC-Signature: t=<unix seconds>,v1=<hex>` header, where `v1` is the HMAC-SHA256 of `` `${t}.${rawBody}` `` with your signing secret. `verifyWebhook` checks it against the **raw** body, rejects timestamps more than 300 seconds away from now, and returns the parsed event. Read the body with `req.text()`: parsing and re-serializing the JSON changes the bytes and breaks the signature.

```ts
// app/api/webhooks/whitechain/route.ts
import { verifyWebhook, WebhookSignatureError, type WebhookEvent } from "@whitechain-commerce/react/server";
import { orders, processedEvents } from "@/lib/orders";

/** "4.99" or "4.990000" -> 4990000n, so amounts compare exactly. */
function toMicro(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole || "0") * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}

export async function POST(req: Request) {
  const raw = await req.text(); // the raw body: the signature covers these exact bytes
  const header = req.headers.get("wc-signature");

  let event: WebhookEvent;
  try {
    event = verifyWebhook<WebhookEvent>(raw, header, process.env.WC_WEBHOOK_SECRET!);
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    throw err;
  }

  // Deliveries are at least once: skip events you have already handled.
  if (processedEvents.has(event.id)) return Response.json({ received: true });

  // Unknown orders (for example a dashboard test event with orderId "test_order") are ignored with a 2xx.
  const order = orders.get(event.data.payment.orderId);

  if (order && event.type === "payment.succeeded") {
    const { payment } = event.data;
    if (toMicro(payment.amount) === toMicro(order.amount)) {
      if (order.status === "pending") order.status = "paid";
      order.paymentId = payment.id;
      // Fulfil the order here: ship, send the receipt, and so on.
    }
  } else if (order && event.type === "refund.succeeded") {
    const { payment } = event.data;
    // payment.amountRefunded is the running total. Events can arrive out of order: never move it backwards.
    if (toMicro(payment.amountRefunded) > toMicro(order.amountRefunded)) order.amountRefunded = payment.amountRefunded;
    if (payment.status === "refunded") order.status = "refunded";
    else if (payment.status === "partially_refunded" && order.status !== "refunded") order.status = "partially_refunded";
  }

  processedEvents.add(event.id);
  return Response.json({ received: true });
}
```

`apps/demo-store/src/app/api/webhooks/whitechain/route.ts` is a complete version that also keeps a webhook log.

Rules for the handler:

- Answer with any 2xx status once you have stored the result. Any other status, a redirect, or no answer within 10 seconds counts as a failure. Failed deliveries are retried after 1 minute, 5 minutes and 30 minutes, then marked `failed`.
- Deduplicate on `event.id` (`evt_...`).
- Match the payment to your order with `payment.orderId`, your own order id, and check `payment.amount`.
- Refund events can arrive out of order. Never move an order's refunded total backwards.

To check your endpoint without paying, choose **Send test event** on the endpoint card. It sends a signed `payment.succeeded` with payment id `pay_test_...` and order id `test_order`, and shows the result straight away. Test events are not retried. See [Webhooks](./webhooks.md) for the full event format.

## 7. Test with testnet USDT

The customer wallet needs two things on Whitechain Sepolia:

- **WBT for gas.** Get it from the faucet at https://faucet.testnet.whitechain.io.
- **Testnet USDT** (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`). The faucet only gives WBT. For the first live demo run, the customer swapped WBT for USDT in the YetiTrade testnet pool ([transaction](https://explorer.testnet.whitechain.io/tx/0x1c12f7c1b1d372147975f03f11d10b1a1be46bc5ed2177ac7055c121b3b5ddd6)).

Then:

1. Create an order in your store so your server creates a session, and open your checkout page.
2. Connect the customer wallet, approve and pay. The widget shows the payment as confirmed once the indexer has checked it, usually within a few seconds.
3. Your webhook handler receives `payment.succeeded`. Mark the order paid there.
4. In the dashboard, open **Payments** to see the payment with its explorer link.

To try a refund, open the payment in the dashboard and choose **Refund**. Connect the payout wallet, enter a full or partial amount, approve and send. Your handler receives `refund.succeeded`. See [Refunds](./refunds.md).

If you don't want to spend real testnet funds, run the whole flow against a local Anvil fork of Whitechain Sepolia. See [Testing](./testing.md).

## Next steps

- [Checkout sessions](./checkout-sessions.md): idempotency, expiry and metadata.
- [Webhooks](./webhooks.md): signature details, retries and redelivery.
- [API reference](./api-reference.md): payments and refunds over HTTP.
- [Errors](./errors.md): what each error type means.
