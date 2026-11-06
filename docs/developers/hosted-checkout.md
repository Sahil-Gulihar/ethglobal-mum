---
title: "Hosted checkout"
description: "Send customers to a payment page that White Money serves, with no frontend code on your side."
---

Every checkout session has a `url` field. It points to the hosted checkout page, `/checkout/:sessionId` on the White Money dashboard. The page renders the same [checkout widget](./checkout-widget.md) you can embed, centered on its own page, and sends the customer back to your `successUrl` after they pay.

## How it works

1. Your server creates a checkout session with your secret key, including a `successUrl` and a `cancelUrl`.
2. You redirect the customer to the session's `url`.
3. The customer connects a wallet and pays in USDT. The funds go straight from their wallet to your payout wallet.
4. Once the backend has verified the payment onchain, the page redirects the customer to your `successUrl`.
5. Your server receives a signed `payment.succeeded` webhook and fulfils the order. See [Webhooks](./webhooks.md).

## The checkout URL

Always use the `url` returned by the API. For example, `https://100lana.com/checkout/cs_...`.

`url` is part of the secret view of a session (`CheckoutSession`), returned when you create it with your secret key. The public view (`GET /api/v1/checkout_sessions/:id`, used by the widget) does not include it.

## Create a session

With curl:

```bash
curl -X POST https://100lana.com/api/v1/checkout_sessions \
  -H "Authorization: Bearer sk_test_..." \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "amount": "4.99",
    "successUrl": "https://store.example.com/orders/order_123",
    "cancelUrl": "https://store.example.com/"
  }'
```

The response is the full session, including `"url": "https://100lana.com/checkout/cs_..."`. A new session returns HTTP `201`. If an unexpired `open` session (or a `processing` one) for the same `orderId` and amount already exists, the API returns it with HTTP `200`.

With the server helper:

```ts
import { createCheckoutSession } from "@whitechain-commerce/react/server";

const session = await createCheckoutSession({
  apiBase: "https://100lana.com",
  secretKey: process.env.WC_SECRET_KEY!, // sk_test_...
  orderId: "order_123",
  amount: "4.99",
  successUrl: "https://store.example.com/orders/order_123",
  cancelUrl: "https://store.example.com/",
});
// session.url === "https://100lana.com/checkout/cs_..."
```

For every parameter and error, see [`createCheckoutSession`](./checkout-widget.md#createcheckoutsessionparams) and the [API reference](./api-reference.md).

## Redirect the customer

Redirect from your server so the amount and secret key never touch the browser. This Next.js route handler creates a session and answers with a `303` redirect, so a plain HTML form can start the checkout:

```ts
// app/api/checkout/route.ts
import { createCheckoutSession } from "@whitechain-commerce/react/server";

export async function POST() {
  const orderId = `order_${Date.now()}`;
  const session = await createCheckoutSession({
    apiBase: process.env.WC_API_ORIGIN ?? "https://100lana.com",
    secretKey: process.env.WC_SECRET_KEY!,
    orderId,
    amount: "4.99",
    successUrl: `https://store.example.com/orders/${orderId}`,
    cancelUrl: "https://store.example.com/",
  });
  return Response.redirect(session.url, 303);
}
```

```tsx
<form action="/api/checkout" method="POST">
  <button type="submit">Pay with USDT</button>
</form>
```

## Return URLs

Both URLs are optional. Each must be an `http` or `https` URL of at most 2048 characters.

| Field | What the hosted page does with it |
| --- | --- |
| `successUrl` | After the payment is verified, the page shows "Payment confirmed. Taking you back to the store…" and redirects there after 2 seconds. The success screen also has a "Return to store" button linking to it. |
| `cancelUrl` | Shows a "Cancel and return to store" button while the customer is choosing a wallet, switching networks or reviewing the payment. Clicking it navigates there. If the session has expired, the expired screen has a "Return to store" button linking to it. |

Details:

- The page does not add query parameters to either URL. Put whatever you need to find the order, such as your order id, in the URL itself.
- If a customer opens the page for a session that is already paid, it shows "This order is already paid" and does not redirect on its own. The "Return to store" button still links to `successUrl`.
- Without a `successUrl`, the customer stays on the success screen.
- Without a `cancelUrl`, there is no cancel button and the expired screen has no return button.
- Reaching `successUrl` is not proof of payment. Anyone can open that URL. Fulfil orders only from a verified `payment.succeeded` webhook.

## Query parameters

The hosted page reads one query parameter:

| Parameter | Values | Default | Description |
| --- | --- | --- | --- |
| `theme` | `dark` | Light | `?theme=dark` renders the checkout card in the dark theme. Any other value, or none, renders it in the light theme. |

```
https://100lana.com/checkout/cs_...?theme=dark
```

The theme changes the checkout card. The page around it always has a dark background.

## What the customer sees

The page has a "White Money" header with a "Secure checkout" badge, the checkout card in the middle, and a footer that says "Funds go straight from your wallet to the merchant on Whitechain. We never hold your money." Search engines are asked not to index it.

The card shows your merchant name, the order id, the amount in USDT and a countdown to the session's expiry (sessions last 30 minutes from creation). The customer then goes through the same steps as in the embedded widget: choose a wallet, switch networks if needed, check the balance, approve the exact amount if needed, pay and wait for verification. See [What the customer sees](./checkout-widget.md#what-the-customer-sees) for each screen, including expired sessions, errors and wallet rejections.

If the session id does not exist, the card shows "We couldn't load this checkout" with the API's error message (for example `No checkout session cs_123.`) and a "Try again" button.

## Hosted or embedded

| | Hosted checkout | Embedded widget |
| --- | --- | --- |
| Frontend code | None. Redirect to `session.url`. | Render `<WhitechainCheckout />` in your React app. |
| Where the customer pays | On the White Money domain. | On your own page, next to your order summary. |
| After payment | Automatic redirect to `successUrl` after 2 seconds. | Your `onSuccess` callback decides. The widget does not redirect on its own. |
| Cancel | Navigates to `cancelUrl`. | Your `onCancel` callback, or `cancelUrl` if you do not pass one. |
| Theme | `?theme=dark` query parameter. | `theme` prop. |
| Requirements | Any backend that can make an HTTP request. | React 18 or later and the workspace package `@whitechain-commerce/react`. |

Use the hosted checkout when you are not on React, want the fastest integration, or prefer to keep payment UI off your site. Use the embedded widget when you want the customer to stay on your page and control what happens after payment.

Either way, the session, the onchain payment and the webhooks are the same.

## Limitations

- USDT is the only currency.
- The hosted page has no merchant branding beyond your merchant name. There are no logo or color settings.
- `theme` is the only query parameter.

## Related

- [Checkout widget](./checkout-widget.md)
- [Checkout sessions](./checkout-sessions.md)
- [Webhooks](./webhooks.md)
- [API reference](./api-reference.md)
- [Errors](./errors.md)
