# @whitechain-commerce/react

Non-custodial USDT checkout as one React component. The customer pays from their own wallet straight to your payout wallet; we never hold funds.

## 1. Create a session on your server

```ts
// app/api/checkout/route.ts
import { createCheckoutSession } from "@whitechain-commerce/react/server";

export async function POST() {
  const session = await createCheckoutSession({
    apiBase: "http://localhost:3000",
    secretKey: process.env.WC_SECRET_KEY!, // sk_test_...
    orderId: "order_456",
    amount: "49.99", // USDT, decided on the server so it can't be tampered with
    successUrl: "https://shop.example/orders/order_456",
  });
  return Response.json({ sessionId: session.id, url: session.url });
}
```

## 2. Render the checkout

```tsx
import { WhitechainCheckout } from "@whitechain-commerce/react";

export default function Checkout({ sessionId }: { sessionId: string }) {
  return (
    <WhitechainCheckout
      sessionId={sessionId}
      apiBase="http://localhost:3000"
      onSuccess={(payment) => {
        // UI only. Fulfil the order from the webhook, not here.
        window.location.href = `/orders/${payment.orderId}`;
      }}
      onError={(error) => console.error(error)}
    />
  );
}
```

Or skip the component and redirect to the hosted page: `session.url` (`/checkout/:sessionId`).

## 3. Fulfil from the verified webhook

```ts
import { verifyWebhook } from "@whitechain-commerce/react/server";

export async function POST(req: Request) {
  const raw = await req.text(); // the RAW body
  const event = verifyWebhook(raw, req.headers.get("wc-signature"), process.env.WC_WEBHOOK_SECRET!);
  if (event.type === "payment.succeeded") await markPaid(event.data.payment.orderId); // dedupe on event.id
  return new Response("ok");
}
```

`verifyWebhook` throws `WebhookSignatureError` on a bad or stale signature (5 min tolerance).

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `sessionId` | `string` | `cs_...` from step 1 |
| `apiBase` | `string?` | Defaults to `NEXT_PUBLIC_WC_API_BASE`, then `""` (same origin) |
| `onSuccess` | `(r: { sessionId, orderId, paymentId, txHash, explorerUrl, successUrl, alreadyPaid }) => void` | Called once, after the backend has verified the payment onchain. `alreadyPaid` is true when the session was already paid when the widget loaded |
| `onError` | `(e: Error) => void` | Not called for wallet rejections (those show an inline retry) |
| `onCancel` | `() => void` | Default: navigate to the session's `cancelUrl` |
| `theme` | `"light" \| "dark"` | |
| `className` | `string?` | Added to the card root |

What it handles: EIP-6963 wallet discovery (falls back to `window.ethereum`), switching or adding chain 1874, USDT balance and WBT gas checks with a faucet link, an exact-amount `approve` only when the allowance is too low, a simulated `pay` so revert reasons show before signing, polling until the backend marks the session `paid`, account/chain changes, and the 30 minute expiry countdown. Styles are scoped (`.wcc-*`), so the host app needs no Tailwind or CSS setup. Uses viem directly; wagmi is not required.

## Develop

```sh
pnpm --filter @whitechain-commerce/react typecheck
pnpm --filter @whitechain-commerce/react test   # reducer + server helper tests (node:test via tsx)
```
