---
title: "Checkout widget"
description: "Embed a non-custodial USDT checkout in your React app with one component, <WhitechainCheckout />."
---

The widget ships in `@whitechain-commerce/react`. It loads a checkout session, connects the customer's wallet, prompts them to switch networks if needed, checks their balance, asks for an exact-amount USDT approval when needed, sends the payment to the PaymentRouter contract, and waits until the Whitechain Commerce backend has verified the payment onchain.

The customer pays from their own wallet. The funds go straight to your registered payout wallet. Whitechain Commerce never holds them.

If you would rather not embed anything, send the customer to the [hosted checkout](./hosted-checkout.md) instead. It is the same widget on a page we serve.

## How it fits together

1. Your server creates a checkout session with your secret key. The amount is decided on the server, so the browser cannot change it.
2. Your page renders `<WhitechainCheckout sessionId="cs_..." />`.
3. The customer pays. The widget calls `onSuccess` once the backend reports the session as `paid`.
4. Your server receives a signed `payment.succeeded` webhook and fulfils the order. See [Webhooks](./webhooks.md).

Fulfil from the webhook, never from `onSuccess`. See [Security notes](#security-notes).

## Installation

Run `npm install @whitechain-commerce/react` in your store project. Follow the [TypeScript quickstart](./quickstart.md#typescript) to create a checkout session. For hosted checkout, use [HostedCheckoutButton](./quickstart.md#4-add-the-checkout-button) to send shoppers to the hosted page.

Requirements:

| Requirement | Value |
| --- | --- |
| Peer dependencies | `react >=18`, `react-dom >=18` |
| Runtime dependencies | `@whitechain-commerce/core`, `viem ^2` |
| Wallet library | None. The widget talks to the wallet over EIP-1193 with viem. You do not need wagmi. |
| CSS setup | None. See [Styling and isolation](#styling-and-isolation). |

The package has two entry points:

| Import path | Use in | Exports |
| --- | --- | --- |
| `@whitechain-commerce/react` | Browser (client components) | `WhitechainCheckout`, `FAUCET_URL`, `WhitechainApiError`, types `WhitechainCheckoutProps`, `CheckoutSuccess`, `DetectedWallet`, `Eip1193Provider`, `PublicCheckoutSession` |
| `@whitechain-commerce/react/server` | Server only | `createCheckoutSession`, `verifyWebhook`, `WebhookSignatureError`, `SIGNATURE_HEADER`, `WhitechainApiError`, types `CreateCheckoutSessionParams`, `CheckoutSession`, `WebhookEvent`, `WebhookEventType`, `PaymentObject`, `RefundObject` |

Never import `@whitechain-commerce/react/server` in browser code. It is meant to run with your secret key, and `verifyWebhook` uses `node:crypto`.

## Quick start

Create the session on your server. This example is a Next.js route handler:

```ts
// app/api/checkout/route.ts
import { createCheckoutSession } from "@whitechain-commerce/react/server";

export async function POST() {
  const orderId = `order_${Date.now()}`;
  const session = await createCheckoutSession({
    apiBase: process.env.WC_API_ORIGIN ?? "https://100lana.com",
    secretKey: process.env.WC_SECRET_KEY!, // sk_test_...
    orderId,
    amount: "4.99", // USDT, decided on the server
    successUrl: `https://store.example.com/orders/${orderId}`,
    cancelUrl: "https://store.example.com/",
  });
  return Response.json({ orderId, sessionId: session.id });
}
```

Render the widget in a client component:

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
      apiBase={process.env.NEXT_PUBLIC_WC_API_BASE ?? "https://100lana.com"}
      // UI only. Fulfil the order from the payment.succeeded webhook.
      onSuccess={() => router.push(`/orders/${orderId}`)}
      onError={(error) => console.error("Checkout error", error)}
    />
  );
}
```

The demo store uses the same pattern in `apps/demo-store/src/app/api/orders/route.ts` and `apps/demo-store/src/app/checkout/[orderId]/pay.tsx`. Its route also computes the amount from a server-side catalog and adds `metadata`.

## Props

| Prop | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `sessionId` | `string` | Yes | | The checkout session id (`cs_...`) returned by `createCheckoutSession` or `POST /api/v1/checkout_sessions`. |
| `apiBase` | `string` | No | See [API base resolution](#api-base-resolution) | Origin of the Whitechain Commerce API, for example `"https://100lana.com"`. A trailing slash is removed. |
| `onSuccess` | `(result: CheckoutSuccess) => void` | No | | Called once, when the session is `paid` according to the backend. UI only. |
| `onError` | `(error: Error) => void` | No | | Called on failures. Not called when the customer rejects a request in their wallet. |
| `onCancel` | `() => void` | No | Navigate to the session's `cancelUrl` | Called when the customer clicks "Cancel and return to store". |
| `theme` | `"light" \| "dark"` | No | `"light"` | Color theme of the card. |
| `className` | `string` | No | | Extra class names added to the card's root element (next to `wcc-root`). |

There are no other props.

### API base resolution

The widget calls two endpoints on the API base: `GET {apiBase}/api/v1/checkout_sessions/{sessionId}` and `POST {apiBase}/api/v1/checkout_sessions/{sessionId}/submit`. It resolves the base in this order:

1. The `apiBase` prop, if you pass it (an empty string counts and means same origin).
2. `process.env.NEXT_PUBLIC_WC_API_BASE`, if it is set. In the browser this only works when your bundler inlines the variable at build time (Next.js does this for `NEXT_PUBLIC_` variables). Passing `apiBase` explicitly is the most reliable option.
3. `""`, which means relative URLs on the current origin.

Trailing slashes are stripped. The hosted checkout page passes `apiBase=""` because it is served by the API itself.

The API sends `Access-Control-Allow-Origin: *` on `/api/v1/*`, so the widget can call it from your store's origin.

### `onSuccess` payload

`onSuccess` receives a `CheckoutSuccess` object:

| Field | Type | Description |
| --- | --- | --- |
| `sessionId` | `string` | The checkout session id (`cs_...`). |
| `orderId` | `string` | Your order id, as you passed it when creating the session. |
| `paymentId` | `string` | The payment id (`pay_...`). Empty string if the session has no payment record yet. |
| `txHash` | `` `0x${string}` `` | Hash of the payment transaction. |
| `explorerUrl` | `string` | Link to the transaction on `https://explorer.testnet.whitechain.io`. |
| `successUrl` | `string \| null` | The session's `successUrl`, or `null` if you did not set one. |
| `alreadyPaid` | `boolean` | `true` when the session was already paid when the widget loaded, so no payment happened in this visit. |

`onSuccess` fires at most once per mount, including for already-paid sessions. If your callback throws, the widget ignores the error.

### `onError`

`onError` receives an `Error`. It is called when:

- the session cannot be loaded (for example a 404 for an unknown session id, or the API is unreachable)
- connecting the wallet fails (except when the wallet already has a connection request open, error `-32002`, which is shown inline only)
- switching or adding the network fails
- the approval or payment step fails: a wallet error, a simulated revert of `approve` or `pay`, an approval transaction that reverted, or an allowance that is still too low after the approval
- reporting the transaction hash to the backend fails twice

It is not called when the customer rejects a request in their wallet (EIP-1193 error `4001` or viem's `UserRejectedRequestError`). Those show an inline message with a retry. It is also not called for a failed balance read, an onchain revert of the payment transaction, or a pending payment the backend could not match; those are shown inline.

Values that are not `Error` instances are wrapped in an `Error`. Errors from the API are `WhitechainApiError` instances with `status` (HTTP status, `0` for network failures) and `type` (`"invalid_request"`, `"authentication"`, `"not_found"`, `"conflict"`, `"server_error"` or `"network_error"`). Other errors come from the wallet or viem.

### `onCancel`

The "Cancel and return to store" button appears only if you pass `onCancel` or the session has a `cancelUrl`. If you pass `onCancel`, the widget calls it and does nothing else. If you do not, the widget sets `window.location.href` to the session's `cancelUrl`.

The button is shown while the customer is choosing a wallet, switching networks or reviewing the payment. It is hidden once an approval or payment is in progress.

## What the customer sees

The widget is driven by a state machine in `packages/react/src/state.ts`. Each phase below maps to a screen or a button state.

### Loading

The widget shows a skeleton while it fetches the session. If the fetch fails, it shows "We couldn't load this checkout" with the error message and a "Try again" button. Depending on the session's `status`, it then goes to:

| Session status | Widget phase |
| --- | --- |
| `open` | Wallet selection |
| `processing` | Confirming (a payment was already submitted) |
| `paid` | Success, with the title "This order is already paid" and `alreadyPaid: true` |
| `expired` | Expired |

The header always shows your merchant name, the order id, and the amount in USDT.

### Expiry countdown

Sessions expire 30 minutes after they are created. While the customer is choosing a wallet, switching networks or reviewing the payment, the header shows a countdown pill to the session's `expiresAt` (for example `29:41`). It turns red under 2 minutes. When it reaches zero, the widget switches to the expired screen.

Once an approval or payment starts, the countdown is hidden and the widget no longer expires the session on its own.

### 1. Choose a wallet

The widget discovers wallets with EIP-6963 (`eip6963:requestProvider` and `eip6963:announceProvider`) and lists each one with its name and icon. If no wallet announces itself within 400 ms, it falls back to `window.ethereum` and labels it Rabby, Coinbase Wallet, MetaMask or "Browser wallet" from the provider's flags.

If no wallet is found at all, it shows "No wallet found" with a link to install MetaMask.

The widget remembers the last wallet used (in `localStorage` under `wc-commerce:last-wallet`) and tries to reconnect it silently with `eth_accounts` on the next load. A silent reconnect never opens a wallet prompt.

Clicking a wallet calls `eth_requestAccounts`. While the request is open the screen says "Approve the connection in your wallet…". If the wallet already has a pending connection request (error `-32002`), the widget shows "A connection request is already open. Check your wallet."

### 2. Switch networks

If the wallet is on another chain, the widget shows "Switch networks" and a "Switch network" button. It calls `wallet_switchEthereumChain` with chain id `0x752` (1874). If the wallet does not know the chain (error `4902`), it calls `wallet_addEthereumChain` with:

| Field | Value |
| --- | --- |
| `chainId` | `0x752` |
| `chainName` | Configured wallet network name |
| `nativeCurrency` | `{ name: "WhiteBIT Coin", symbol: "WBT", decimals: 18 }` |
| `rpcUrls` | `["https://rpc.testnet.whitechain.io"]` (or `NEXT_PUBLIC_WHITECHAIN_RPC_URL` if it is set and inlined at build time) |
| `blockExplorerUrls` | `["https://explorer.testnet.whitechain.io"]` |

If the wallet is still on another chain afterwards, the widget shows "Your wallet is still on another network. Switch networks to continue."

The widget listens for `accountsChanged`, `chainChanged` and `disconnect`. If the customer changes account or network before paying, it re-reads balances or returns to the right step. The "Change" link next to the account disconnects and returns to wallet selection.

### 3. Review and balance check

On chain 1874 the widget shows the paying account, its USDT balance, the network and the total. It reads three values and refreshes them every 8 seconds:

- the USDT `balanceOf` the account
- the USDT `allowance` from the account to the PaymentRouter
- the account's native WBT balance, for gas

The pay button reads "Checking balance…" until the reads finish. Then:

- If the USDT balance is below the amount, the button is disabled and a warning links to the faucet at `https://faucet.testnet.whitechain.io`. The balance refreshes on its own, so the customer can top up and come back.
- If the WBT balance is zero, the button is disabled. When the USDT balance is enough, a warning says the customer needs WBT for network fees, with the faucet link. (If both are short, only the USDT warning shows.)
- If the allowance is below the amount, the button reads "Approve & pay 4.99 USDT".
- Otherwise it reads "Pay 4.99 USDT".

A progress list shows the steps: Connect wallet, Approve USDT (only when an approval is needed), Confirm payment, Settlement on Whitechain.

### 4. Approve the exact amount

If the allowance is too low, the widget asks the wallet to `approve(router, amount)` on the USDT contract for the exact session amount, never an unlimited allowance. The button shows "Approve USDT in your wallet…" and then "Waiting for approval to confirm…" with a link to the transaction.

Some Tether-style tokens refuse to change a non-zero allowance. If the account already has a non-zero but too-small allowance, the widget simulates the approval first. If that simulation fails, it sends `approve(router, 0)` and waits for it before sending the real approval. The customer then signs two approvals.

After the approval is mined, the widget checks the receipt and re-reads the allowance. It stops with an error if the approval reverted or the allowance is still too low.

### 5. Pay

The widget simulates `PaymentRouter.pay(chainMerchantId, chainOrderId, amount)` before asking for a signature, so revert reasons (for example an order that is already paid) show up before the customer signs. It then asks the wallet to send the transaction. The button shows "Confirm payment in your wallet…".

The router address, token address, `chainMerchantId` and `chainOrderId` all come from the session. The deployed PaymentRouter is `0xa99a6D97607567f4fe734831910D24f4e9BD0508` and USDT is `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` (6 decimals).

### 6. Submit and confirm

As soon as the wallet returns a transaction hash, the widget:

1. Posts it to `POST /api/v1/checkout_sessions/{id}/submit` as `{ "txHash": "0x..." }`. If that fails, it retries once after 3 seconds. The hash is only a hint. The backend never marks a session paid from it without validating the transaction onchain, and the indexer finds the payment even if the hint never arrives.
2. Polls `GET /api/v1/checkout_sessions/{id}` every 2 seconds.
3. Watches the transaction receipt itself (for up to 180 seconds).

The screen shows "Confirming payment…", a link to the transaction, and "Transaction sent. Waiting for Whitechain Commerce to verify the payment onchain. You can keep this page open."

From here:

- If the session becomes `paid`, the widget shows success.
- If the payment transaction reverts onchain, it returns to review with "The payment transaction reverted onchain. No funds moved; you can try again."
- If the backend moves the session from `processing` back to `open` (the hinted transaction did not pay this session), it returns to review with "We couldn't verify that transaction. No payment was taken; you can try again."
- If the session becomes `expired`, it shows the expired screen.

### 7. Success

The success screen shows "Payment complete" (or "This order is already paid"), the amount and merchant name, and a link to the transaction on the explorer. If the session has a `successUrl`, a "Return to store" button links to it. The embedded widget does not redirect on its own; do that in `onSuccess` if you want it.

`onSuccess` fires once when this screen appears.

### Expired

"This checkout has expired. No payment was taken. Return to the store to start a new checkout." If the session has a `cancelUrl`, a "Return to store" button links to it. Create a new session to let the customer try again.

### Errors and wallet rejections

Errors appear in a dismissible banner, and the widget returns to the nearest step the customer can retry from. For example, a failed approval or payment goes back to review, and a failed network switch goes back to the switch screen.

If the customer rejects a request in their wallet, the banner says "Request rejected in your wallet. You can try again." and `onError` is not called.

A screen-reader status region announces errors and most phase changes (connecting, wrong network, review, approval, payment, confirming, success and expired).

## Server helpers

Import these from `@whitechain-commerce/react/server` in route handlers or server actions.

### `createCheckoutSession(params)`

Creates a checkout session by calling `POST {apiBase}/api/v1/checkout_sessions` with `Authorization: Bearer <secretKey>`. Returns a `Promise<CheckoutSession>`.

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `apiBase` | `string` | No | API origin, for example `"https://100lana.com"`. Defaults to `NEXT_PUBLIC_WC_API_BASE`. Required if that is not set. |
| `secretKey` | `string` | Yes | Your secret key (`sk_test_...`). |
| `orderId` | `string` | Yes | Your own order id. One session pays one order. The API accepts 1 to 200 characters after trimming. |
| `amount` | `string` | Yes | Positive decimal USDT amount with at most 6 decimals, for example `"49.99"`. |
| `successUrl` | `string` | No | `http` or `https` URL, at most 2048 characters. |
| `cancelUrl` | `string` | No | `http` or `https` URL, at most 2048 characters. |
| `metadata` | `Record<string, string>` | No | Up to 20 keys. Keys at most 40 characters, values at most 500. |

The helper always sends `currency: "USDT"`. It does not read `WC_API_BASE`; pass that yourself as `apiBase` if you use it.

The returned `CheckoutSession` includes `id`, `status`, `url` (the [hosted checkout](./hosted-checkout.md) URL), `amount`, `amountUnits`, `expiresAt`, `successUrl`, `cancelUrl`, `metadata`, `createdAt` and the onchain fields the widget needs. See the [API reference](./api-reference.md) for every field.

Creating a session is idempotent per order: if an `open`, unexpired (or `processing`) session already exists for the same `orderId` and amount, the API returns that session instead of a new one.

#### Errors

The helper throws `WhitechainApiError` with `message`, `status` and `type`.

| When | `status` | `type` |
| --- | --- | --- |
| `secretKey` is empty or does not start with `sk_` (checked locally) | `0` | `authentication` |
| `orderId` is empty (checked locally) | `0` | `invalid_request` |
| `amount` is not a positive decimal string with at most 6 decimals (checked locally) | `0` | `invalid_request` |
| No `apiBase` and no `NEXT_PUBLIC_WC_API_BASE` (checked locally) | `0` | `invalid_request` |
| The API cannot be reached | `0` | `network_error` |
| Missing, invalid or revoked key, or the merchant account is not active | `401` | `authentication` |
| The body fails validation (bad URL, too many metadata keys, and so on) | `400` | `invalid_request` |
| No payout wallet registered yet | `409` | `conflict` |
| The order has already been paid | `409` | `conflict` |
| Another payment for this order is already processing | `409` | `conflict` |
| Unexpected server error | `500` | `server_error` |

```ts
import { createCheckoutSession, WhitechainApiError } from "@whitechain-commerce/react/server";

try {
  const session = await createCheckoutSession({
    apiBase: "https://100lana.com",
    secretKey: process.env.WC_SECRET_KEY!,
    orderId: "order_456",
    amount: "49.99",
  });
  console.log(session.id, session.url);
} catch (err) {
  if (err instanceof WhitechainApiError && err.type === "conflict") {
    // For example: the order is already paid.
  }
  throw err;
}
```

### `verifyWebhook(rawBody, header, secret, toleranceSeconds?, nowSeconds?)`

Verifies a webhook's `WC-Signature` header against the raw request body and returns the parsed event.

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `rawBody` | `string` | Yes | The exact request body. Read it with `await req.text()` before parsing. |
| `header` | `string \| null \| undefined` | Yes | The `WC-Signature` header value. `SIGNATURE_HEADER` is `"wc-signature"`. |
| `secret` | `string` | Yes | Your webhook endpoint's signing secret (`whsec_...`). |
| `toleranceSeconds` | `number` | No | Maximum clock difference. Default `300` (5 minutes). |
| `nowSeconds` | `number` | No | Current Unix time in seconds. Default `Math.floor(Date.now() / 1000)`. Useful in tests. |

It returns `WebhookEvent` by default, or the type you pass as a generic (`verifyWebhook<MyType>(...)`).

```ts
// app/api/webhooks/whitechain/route.ts
import { verifyWebhook, WebhookSignatureError } from "@whitechain-commerce/react/server";

export async function POST(req: Request) {
  const raw = await req.text(); // the signature covers these exact bytes
  try {
    const event = verifyWebhook(raw, req.headers.get("wc-signature"), process.env.WC_WEBHOOK_SECRET!);
    if (event.type === "payment.succeeded") {
      // Dedupe on event.id, then fulfil event.data.payment.orderId.
    }
    return Response.json({ received: true });
  } catch (err) {
    if (err instanceof WebhookSignatureError) return new Response("Invalid signature", { status: 400 });
    throw err;
  }
}
```

### `WebhookSignatureError`

`verifyWebhook` throws `WebhookSignatureError` (a subclass of `Error`) with one of these messages:

| Message | Cause |
| --- | --- |
| `Missing WC-Signature header` | The header is empty or absent. |
| `Malformed WC-Signature header` | The header has no valid `t=` or `v1=` part. |
| `Timestamp outside tolerance` | `t` is more than `toleranceSeconds` away from now. |
| `Signature mismatch` | The HMAC does not match. Usually the wrong secret, or the body was parsed and re-serialized. |

If the signature is valid but the body is not JSON, `JSON.parse` throws a regular `SyntaxError`.

For the signature scheme, event types and retries, see [Webhooks](./webhooks.md).

## Styling and isolation

The widget injects its own stylesheet in a `<style>` tag inside the component. Every class it uses is prefixed with `wcc-`, and element rules (links, buttons, `box-sizing`) are scoped under `.wcc-root`. It does not depend on Tailwind or any CSS framework in your app, and it does not style your own elements.

- The card is `width: 100%` with `max-width: 400px`, centered with `margin: 0 auto`. Put it in a container of the width you want.
- `theme="dark"` sets `data-theme="dark"` on the root and swaps the color variables.
- Text uses a system font stack.
- On viewports 440 px wide or less, the card uses a smaller corner radius and amount size.
- With `prefers-reduced-motion: reduce`, transitions are turned off and animations are cut to near-zero duration (except the spinner).
- The footer reads "Non-custodial · Powered by Whitechain Commerce".

Most of the widget's rules use a single class, and its `<style>` tag is rendered inside the component, so it usually comes after your stylesheets in the document. A plain `.my-class` rule with the same specificity can then lose to it. If you override styles through `className`, use a more specific selector, for example `.my-class.wcc-root`. Class names other than `wcc-root` are internal and may change.

The component file starts with `"use client"`. In the Next.js App Router, render it from a client component when you pass callbacks, since functions cannot be passed from a server component to a client component.

## Security notes

- **`onSuccess` is not proof of payment.** It runs in the customer's browser, which you do not control. Use it only for UI, such as a redirect to an order page. Mark orders paid only from a `payment.succeeded` webhook whose signature you verified with `verifyWebhook`.
- **Check the amount in the webhook.** Compare `event.data.payment.amount` and `orderId` against your own order record before fulfilling. The demo store does this in `apps/demo-store/src/app/api/webhooks/whitechain/route.ts`.
- **Dedupe on `event.id`.** Webhooks can be delivered more than once.
- **Create sessions on the server.** Never put your `sk_test_` key in browser code. The widget needs only the session id, and the session's public view (`GET /api/v1/checkout_sessions/:id`) contains no secrets.
- **The transaction hash the widget submits is a hint.** The backend validates the transaction onchain before marking a session `paid`.
- **Exact approvals.** The widget never asks for an unlimited USDT allowance.

## Limitations

- USDT is the only currency.
- The package is not published to npm. It is consumed as a workspace package and exports TypeScript source that your bundler must compile.
- The server helpers cover `createCheckoutSession` and `verifyWebhook` only. For payments and refunds, call the HTTP API directly. See the [API reference](./api-reference.md).
- The customer needs a browser wallet (an EIP-6963 wallet or `window.ethereum`), testnet USDT and some WBT for gas.

## Related

- [Hosted checkout](./hosted-checkout.md)
- [Checkout sessions](./checkout-sessions.md)
- [Webhooks](./webhooks.md)
- [API reference](./api-reference.md)
- [Errors](./errors.md)
