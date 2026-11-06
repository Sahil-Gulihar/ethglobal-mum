---
title: "Refunds"
description: "Refunds send USDT from your payout wallet back to the customer's wallet, signed by you, because the platform never holds funds."
---

Whitechain Commerce is non-custodial. A payment goes straight from the customer to your payout wallet, so there is no platform balance to refund from. A refund is an onchain transaction that your payout wallet signs: `refund(chainPaymentId, amount)` on the PaymentRouter, which moves the USDT from your payout wallet to the original payer. The API can record a refund request, but it cannot complete one.

## How a refund works

1. **Request.** You create a pending refund, either with `POST /api/v1/refunds` or with the Refund button on the payment's page in the dashboard. The amount is reserved against the payment.
2. **Sign.** In the dashboard, on the payment's page, you connect your payout wallet and sign. If the router's USDT allowance is lower than the refund, the dashboard first asks you to sign `approve(router, amount)` on the USDT token, then `refund(chainPaymentId, amount)` on the router.
3. **Settle.** The router moves the USDT from your payout wallet to the payer and emits `Refunded`.
4. **Record.** The indexer validates the event, marks the refund `succeeded` with its `txHash`, updates the payment's `amountRefunded` and `status`, and queues a `refund.succeeded` webhook.

The dashboard runs step 4 right after the transaction confirms, so you usually see the result within seconds. The background indexer does the same thing on its next pass if that fails.

## Create a refund request with the API

```bash
curl -X POST https://whitechain-dashboard.vercel.app/api/v1/refunds \
  -H "Authorization: Bearer $WC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "paymentId": "pay_Vb3kT9wQ2mXr7LpN5sZe", "amount": "10.00" }'
```

```json
{
  "id": "re_Jt6pW2nR8vKx3QmY9cLa",
  "paymentId": "pay_Vb3kT9wQ2mXr7LpN5sZe",
  "orderId": "order_1042",
  "amount": "10.00",
  "currency": "USDT",
  "status": "pending",
  "txHash": null,
  "explorerUrl": null,
  "createdAt": "2026-11-06T11:02:40.000Z"
}
```

```ts
import type { RefundObject } from "@whitechain-commerce/react/server";

const res = await fetch("https://whitechain-dashboard.vercel.app/api/v1/refunds", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.WC_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ paymentId: "pay_Vb3kT9wQ2mXr7LpN5sZe", amount: "10.00" }),
});
if (!res.ok) {
  const { error } = await res.json();
  throw new Error(`${error.type}: ${error.message}`);
}
const refund = (await res.json()) as RefundObject; // status: "pending"
```

The refund is not sent yet. Open the payment in the dashboard (Payments, then the payment) and click **Sign pending 10.00 USDT refund**. The amount is fixed by the request.

Each call creates a new request. Requests are not idempotent, so do not retry a refund call blindly; list the payment's refunds first.

Full schema in the [API reference](./api-reference.md#create-a-refund).

## What you need to sign

- **Your current payout wallet.** Only the wallet currently registered for your merchant can call `refund()`. Any other wallet reverts with `NotPayout`. If you changed your payout wallet after the payment, sign from the new one; the dashboard shows a notice when the payment settled to a different wallet.
- **Enough USDT in that wallet.** The dashboard checks the balance before asking you to sign.
- **An allowance for the router.** The dashboard asks for `approve(router, amount)` for exactly the refund amount when the current allowance is lower.
- **A little WBT for gas** on Whitechain Sepolia, for the approve and refund transactions.

The refund always goes to the payment's `payer`. You cannot send it to a different address.

## Statuses

| Status | Meaning |
| --- | --- |
| `pending` | Requested but not yet seen onchain. `txHash` is `null`. |
| `succeeded` | The `Refunded` event was indexed. `txHash` and `explorerUrl` are set. |

There is no `failed` or `canceled` status. A pending request stays pending until it is signed or discarded; it does not expire.

The payment's own status reflects only onchain refunds:

| `amountRefunded` | Payment `status` |
| --- | --- |
| `0.00` | `succeeded` |
| Above 0, below `amount` | `partially_refunded` |
| Equal to `amount` | `refunded` |

## Partial refunds and limits

You can refund a payment in several parts until the full amount has been returned.

| Rule | Enforced by |
| --- | --- |
| Amount is a decimal string, greater than zero, at most 6 decimals | API and dashboard |
| Amount is at most the payment amount, minus refunded onchain, minus every other pending request | API and dashboard |
| Amount is at most the payment amount minus refunded onchain | PaymentRouter (`RefundExceedsPayment`) |
| Sender is the merchant's current payout wallet | PaymentRouter (`NotPayout`) |

Pending requests reserve their amount, so concurrent requests cannot add up to more than the payment. A request that would exceed the balance returns `400 invalid_request`:

```
Refund amount exceeds the refundable balance (39.99 USDT available after refunds and pending refunds).
```

## Discarding a pending refund

A pending refund that you no longer want keeps its amount reserved. Remove it in the dashboard with **Discard** next to the pending request on the payment's page. Discarding deletes the request; it no longer appears in `GET /api/v1/refunds`.

There is no API endpoint to cancel or discard a refund.

When you start a refund from the dashboard's Refund button, the request is discarded for you if anything fails before the refund transaction is broadcast (for example you reject a wallet prompt, the payout wallet does not hold enough USDT, or the approval reverts), or if the refund transaction reverts. If the dashboard times out waiting for a broadcast transaction, the request is kept, so it can still be matched when the transaction confirms. Requests created through the API are never discarded automatically.

## How onchain refunds are matched

When the indexer sees a `Refunded` event, it checks that:

1. the RPC node reports chain id `1874`,
2. the log came from the configured PaymentRouter,
3. a recorded payment has the event's `paymentId` as its `chainPaymentId`,
4. the transaction receipt status is `success`.

Then, for that payment, it looks for the oldest `pending` request with exactly the same amount.

- If there is one, that request becomes `succeeded`.
- If there is none, a new refund is created directly as `succeeded`.

Each `(txHash, logIndex)` is recorded once, so seeing the same event twice does nothing.

The payment's `amountRefunded` is taken from the router's running total (`totalRefunded`) and never moves backwards, even if events are processed out of order.

## Refunds made without an API request

Because matching works from the chain, a refund does not need a prior request. If your payout wallet calls `refund(chainPaymentId, amount)` on the router directly (for example from a script or the explorer), the indexer still records it as a `succeeded` refund, updates the payment and sends `refund.succeeded`. Its `createdAt` is the time it was indexed.

Such a refund does not consume a pending request unless the amounts match exactly. If you created a request for 10.00 and then refunded 10.00 directly, the request is marked `succeeded`. If you refunded 5.00 instead, the 10.00 request stays pending and still reserves its amount; discard it if you do not need it.

Get `chainPaymentId` from the [payment object](./api-reference.md#paymentobject).

## The refund.succeeded webhook

When a refund is recorded, every enabled webhook endpoint receives:

```json
{
  "id": "evt_...",
  "type": "refund.succeeded",
  "created": 1793963000,
  "data": {
    "refund": {
      "id": "re_Jt6pW2nR8vKx3QmY9cLa",
      "paymentId": "pay_Vb3kT9wQ2mXr7LpN5sZe",
      "orderId": "order_1042",
      "amount": "10.00",
      "currency": "USDT",
      "status": "succeeded",
      "txHash": "0x4104654031bd074fbae534380065dad4116c4d62f706858cf10491af9e635d29",
      "explorerUrl": "https://explorer.testnet.whitechain.io/tx/0x4104654031bd074fbae534380065dad4116c4d62f706858cf10491af9e635d29",
      "createdAt": "2026-11-06T11:02:40.000Z"
    },
    "payment": {
      "id": "pay_Vb3kT9wQ2mXr7LpN5sZe",
      "sessionId": "cs_Q3n8ZpK2vRt6YxLm4WbH",
      "orderId": "order_1042",
      "amount": "49.99",
      "amountRefunded": "10.00",
      "currency": "USDT",
      "status": "partially_refunded",
      "payer": "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4",
      "txHash": "0xca1467eb1d7b29899ff948051bd8cd21e1c4581e9e60d6d9cbc0ccf74e97e9b4",
      "explorerUrl": "https://explorer.testnet.whitechain.io/tx/0xca1467eb1d7b29899ff948051bd8cd21e1c4581e9e60d6d9cbc0ccf74e97e9b4",
      "chainId": 1874,
      "chainPaymentId": "0x88dc5926bd868fe33725c7369d5db8d07bb46f80a0a68f78a70dfa0f6ecf40b1",
      "createdAt": "2026-11-06T10:16:12.000Z"
    }
  }
}
```

`data.payment` is the payment after the refund, so you can update the order from `amountRefunded` and `status` directly. No webhook is sent when a pending request is created or discarded. Signature verification and retries are covered in [Webhooks](./webhooks.md).

## Example from a live run

On Whitechain Sepolia, a 5.98 USDT payment was partially refunded by 2.00 USDT from the payout wallet:

- Approve: [`0x96c1ab28…e3f559`](https://explorer.testnet.whitechain.io/tx/0x96c1ab28b6ea31f576f5a833d5e0b785f6fcd250a3962f8252c1ac1f67e3f559)
- Refund: [`0xe2fcbd3d…1bab52`](https://explorer.testnet.whitechain.io/tx/0xe2fcbd3d4a23bbb35964def3f7509bd2883a167164b790733ff069ef5c1bab52)

## Limitations

- Refunds can only be signed in the dashboard, or by calling the router directly from your payout wallet. There is no hosted signing link and no server-side signing.
- Payments made with the wrong amount have no payment record, so they cannot be refunded through the dashboard. See [Wrong amounts](./payments.md#wrong-amounts).
- Refunds are in USDT only, to the original payer only.
