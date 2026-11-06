---
title: "Store integration quickstart"
description: "Add hosted USDT checkout to your store with the Whitechain Commerce API."
---

Add **Pay with USDT** to your checkout. Your server creates a checkout link for each order. The shopper pays on the Whitechain Commerce checkout page. We then send your server a payment update through a webhook. This works with any backend that can send and receive HTTPS requests.

If you only need to share a fixed-price checkout, start with [Payment links](./payment-links.md).

## 1. Set up your merchant account

1. [Create a merchant account](https://100lana.com/signup) with the business name customers should see at checkout.
2. If the dashboard asks you to verify your account, complete the World ID step.
3. In the dashboard, connect your payout wallet or enter its address. Choose **Use as payout wallet** and wait for the dashboard to show that your wallet is ready.
4. In **Developers**, choose **Create secret key**. Copy the `sk_test_` key and store it on your server as `WC_SECRET_KEY`. Set `WC_API_BASE` to the origin of your Whitechain Commerce instance, such as `https://100lana.com`. The SDK adds `/api/v1`.

## 2. Install an SDK

### TypeScript

In your store project:

```bash
npm install @whitechain-commerce/react
```

Use Node.js 20+ on the server. The React package has React and React DOM peer dependencies (18+). See [Checkout widget](./checkout-widget.md) for the React components.

### Python

With Python 3.10 or later, run this from your store's virtual environment:

```bash
python -m pip install whitechain-commerce
```

### Go

With Go 1.23 or later, run this in your store's Go module:

```bash
go get github.com/Sahil-Gulihar/ethglobal-mum/packages/go@v0.1.0
```

## 3. Create a session for each order

When a shopper picks USDT, load their order on your server. Check that the shopper can pay that order and calculate its USDT total from your own prices. Use your store's stable order ID so retries for the same order reuse the existing payable session.

The example below uses a 49.99 USDT order. Replace the example URLs with pages on your store.

### TypeScript

```ts
import { createCheckoutSession } from "@whitechain-commerce/react/server";

const session = await createCheckoutSession({
  apiBase: process.env.WC_API_BASE!,
  secretKey: process.env.WC_SECRET_KEY!,
  orderId: "order_123",
  amount: "49.99",
  successUrl: "https://store.example.com/orders/order_123",
  cancelUrl: "https://store.example.com/cart",
});
```

### Python

```python
import os
from whitechain_commerce import Whitechain

client = Whitechain(
    api_base=os.environ["WC_API_BASE"],
    secret_key=os.environ["WC_SECRET_KEY"],
)
session = client.create_checkout_session(
    order_id="order_123",
    amount="49.99",
    success_url="https://store.example.com/orders/order_123",
    cancel_url="https://store.example.com/cart",
)
# Redirect to session["url"].
```

### Go

```go
package checkout

import (
    "context"
    "os"

    whitechain "github.com/Sahil-Gulihar/ethglobal-mum/packages/go"
)

func createSession(ctx context.Context, orderID, amount string) (whitechain.CheckoutSession, error) {
    client, err := whitechain.NewClient(os.Getenv("WC_API_BASE"), os.Getenv("WC_SECRET_KEY"))
    if err != nil {
        return whitechain.CheckoutSession{}, err
    }
    return client.CreateCheckoutSession(ctx, whitechain.CreateCheckoutSessionParams{
        OrderID: orderID,
        Amount:  amount,
    })
}
```

Save the session ID with your order and redirect the shopper to the session URL (`session.url` in TypeScript, `session["url"]` in Python, or `session.URL` in Go). Keep the secret key on your server. The shopper connects a wallet, switches networks if needed, approves USDT if prompted, and pays. On return to your store, show the order status from your server. The return URL is for navigation.

See [Checkout sessions](./checkout-sessions.md) for expiry, retries, and already-paid orders. For another language, use the [HTTP API reference](./api-reference.md).

## 4. Add the checkout button

The React button submits a native form to your store's checkout handler.

```tsx
import { HostedCheckoutButton } from "@whitechain-commerce/react";

<HostedCheckoutButton action="/api/checkout" orderId={order.id} />;
```

The handler receives an `orderId` form field. Apply your store's CSRF protection, verify order ownership, calculate the amount from your own prices, and create the session. Return HTTP `303` with its URL in the `Location` header. Render the button outside other forms. If your handler expects a `csrfToken` field, pass it as a prop.

In a server-rendered store, use the same handler with a native form. Insert the current order ID and any CSRF field through your template engine.

```html
<form action="/api/checkout" method="post">
  <input type="hidden" name="orderId" value="order_123">
  <button type="submit">Pay with USDT</button>
</form>
```

For wallet checkout embedded in a React page, use [WhitechainCheckout](./checkout-widget.md) with the session ID.

## 5. Verify payment before fulfilling

Add a public HTTPS endpoint in the dashboard under **Webhooks**. Copy its signing secret into your server environment. For each delivery:

1. Verify the `WC-Signature` header against the raw request body before parsing JSON. The SDKs expose `verifyWebhook` (TypeScript), `verify_webhook` (Python), and `VerifyWebhook` (Go). Follow the [signature verification guide](./webhooks.md#verify-signatures).
2. For `payment.succeeded`, find the order by `data.payment.orderId` and check its session ID, amount, and currency against your stored order. Ignore synthetic test events and unknown orders.
3. Record the event ID and payment in durable storage. Make the transition from unpaid to paid and the fulfilment trigger safe to repeat. Return a `2xx` after saving the result so retries cannot ship an order twice.

Use **Send test event** to check that your endpoint receives and verifies a signed request. Then make a [testnet payment](./testing.md) to confirm that the funds reach your payout wallet, the webhook marks the order paid, and the dashboard shows the same payment.

For post-purchase workflows, see [Refunds](./refunds.md) and [Webhooks](./webhooks.md).
