---
title: "Store integration quickstart"
description: "Add hosted USDT checkout to your store with the Whitechain Commerce API."
---

Add **Pay with USDT** to your checkout. Your server creates a checkout link for each order. The shopper pays on the Whitechain Commerce checkout page. We then send your server a payment update through a webhook. This works with any backend that can send and receive HTTPS requests.

If you only need to share a fixed-price checkout, start with [Payment links](./payment-links.md).

## 1. Set up your merchant account

1. [Create a merchant account](https://whitechain-dashboard.vercel.app/signup) with the business name customers should see at checkout.
2. If the dashboard asks you to verify your account, complete the World ID step.
3. In the dashboard, connect your payout wallet or enter its address. Choose **Use as payout wallet** and wait for the dashboard to show that your wallet is ready.
4. In **Developers**, choose **Create secret key**. Copy the `sk_test_` key and store it on your server as `WC_SECRET_KEY`. Use the API base URL shown there (ending in `/api/v1`) as `WC_API_BASE`.

## 2. Create a session for each order

When a shopper picks USDT, load their order on your server. Check that the shopper can pay that order and calculate its USDT total from your own prices. Use your store's stable order ID so retries for the same order reuse the existing payable session.

The example below uses a 49.99 USDT order. Replace the example URLs with pages on your store.

```bash
curl --fail-with-body "$WC_API_BASE/checkout_sessions" \
  -H "Authorization: Bearer $WC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_123",
    "amount": "49.99",
    "currency": "USDT",
    "successUrl": "https://store.example.com/orders/order_123",
    "cancelUrl": "https://store.example.com/cart"
  }'
```

Save the returned session `id` with your order and send the shopper to the returned `url`. Never expose the API key to the browser. The shopper connects a wallet, switches networks if needed, approves USDT if prompted, and pays. On return to your store, show the order status from your server. The return URL is for navigation and does not prove payment.

See [Checkout sessions](./checkout-sessions.md) for expiry, retries, and already-paid orders. If you maintain the React SDK packages in your own build and want checkout embedded in your site, see [Checkout widget](./checkout-widget.md).

## 3. Verify payment before fulfilling

Add a public HTTPS endpoint in the dashboard under **Webhooks**. Copy its signing secret into your server environment. For each delivery:

1. Verify the `WC-Signature` header against the raw request body before parsing JSON. Follow the [signature verification guide](./webhooks.md#verify-signatures).
2. For `payment.succeeded`, find the order by `data.payment.orderId` and check its session ID, amount, and currency against your stored order. Ignore synthetic test events and unknown orders.
3. Record the event ID and payment in durable storage. Make the transition from unpaid to paid and the fulfilment trigger safe to repeat. Return a `2xx` after saving the result so retries cannot ship an order twice.

Use **Send test event** to check that your endpoint receives and verifies a signed request. Then make a [testnet payment](./testing.md) to confirm that the funds reach your payout wallet, the webhook marks the order paid, and the dashboard shows the same payment.

For post-purchase workflows, see [Refunds](./refunds.md) and [Webhooks](./webhooks.md).
