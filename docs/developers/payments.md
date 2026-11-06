---
title: "Payments"
description: "A payment is the record of a validated onchain USDT transfer that paid one checkout session."
---

Payments are never created through the API. The indexer creates one when it sees a `PaymentSettled` event from the PaymentRouter and the event passes every settlement check below. At that moment the session becomes `paid` and a `payment.succeeded` webhook is queued.

## How a payment is created

1. The customer's wallet calls `pay(chainMerchantId, chainOrderId, amountUnits)` on the PaymentRouter. The router moves the USDT from the customer straight to your payout wallet and emits `PaymentSettled`.
2. The indexer picks up the event, either from its regular pass over new blocks or right away when the widget calls the [submit hint](./checkout-sessions.md#the-submit-hint).
3. The event goes through the settlement checks.
4. If it passes, in one database transaction: the payment is inserted, the session is set to `paid`, and a `payment.succeeded` event is queued for each enabled webhook endpoint.

The regular pass scans router logs up to one block behind the chain head (1 confirmation). The hint path waits for the same confirmation depth. Both paths run the same checks and are idempotent, so a payment is recorded once even if both see it.

Check **Payments** for confirmed transactions and **Webhooks** for delivery status.

### Settlement checks

Every `PaymentSettled` event is checked in this order. Any failure skips the event and nothing is recorded (the reason is logged on the server).

| # | Check | On failure |
| --- | --- | --- |
| 1 | The RPC node reports chain id `1874`. | Skipped |
| 2 | The log was emitted by the configured PaymentRouter address. | Skipped |
| 3 | The `token` in the event is the USDT address `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`. | Skipped |
| 4 | `paymentId` equals `keccak256(abi.encode(merchantId, orderId))`. | Skipped |
| 5 | A checkout session exists whose `chainOrderId` equals the event's `orderId`. | Skipped |
| 6 | That session's merchant exists and its `chainMerchantId` equals the event's `merchantId`. | Skipped |
| 7 | No payment is recorded for that session yet. | Returns the existing payment, no new record and no new webhook |
| 8 | The event `amount` equals the session's `amountUnits` exactly. | Skipped, and the session is expired (see [Wrong amounts](#wrong-amounts)) |
| 9 | The session was priced with the token's current `decimals()`. | Skipped |
| 10 | The transaction receipt status is `success`. | Skipped |

Two things are deliberately not checked:

- **The payout address.** The router paid whatever payout wallet was registered onchain at the time of payment. Comparing with the current dashboard value would drop real payments made just before a payout change.
- **Expiry.** A payment that lands after `expiresAt` is still recorded. See [Late payments](#late-payments).

The database also enforces one payment per session, per onchain payment id, and per `(txHash, logIndex)`. One transaction may pay several sessions (for example from a smart wallet), so `txHash` alone is not unique.

## Statuses

| Status | Meaning |
| --- | --- |
| `succeeded` | Paid, nothing refunded. |
| `partially_refunded` | Some of the amount has been refunded onchain. |
| `refunded` | The full amount has been refunded onchain. |

The status follows the router's own running total of refunds (`totalRefunded` in the `Refunded` event), so it only counts refunds that happened onchain. Pending refund requests do not change it. See [Refunds](./refunds.md).

There is no `failed` payment status. A transfer that fails onchain never emits `PaymentSettled`, so no payment exists.

## The payment object

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | `pay_...` |
| `sessionId` | string | The checkout session it paid. |
| `orderId` | string | Your order id. |
| `amount` | string | Amount paid, for example `"49.99"`. |
| `amountRefunded` | string | Total refunded onchain, for example `"0.00"`. |
| `currency` | `"USDT"` | |
| `status` | string | `succeeded`, `partially_refunded` or `refunded`. |
| `payer` | string | The customer's wallet. Refunds go back here. |
| `txHash` | string | The `pay()` transaction. |
| `explorerUrl` | string | Explorer link for `txHash`. |
| `chainId` | `1874` | |
| `chainPaymentId` | string | Onchain payment id, used by `refund()`. |
| `createdAt` | string | When the indexer recorded the payment. |

Full field notes are in the [API reference](./api-reference.md#paymentobject).

## Fulfilling orders

Fulfil when you receive a verified `payment.succeeded` webhook. Its `data.payment` is the payment object above. Match it to your order with `orderId` (or `sessionId`), and dedupe on the event `id`, because a delivery can be retried. See [Webhooks](./webhooks.md).

Do not fulfil from the widget's `onSuccess` callback or from the customer landing on your `successUrl`. Those are UI signals only.

## List and retrieve payments

```bash
# Newest first, 1 to 100 (default 20)
curl "https://whitechain-dashboard.vercel.app/api/v1/payments?limit=50" \
  -H "Authorization: Bearer $WC_SECRET_KEY"

# One payment
curl https://whitechain-dashboard.vercel.app/api/v1/payments/pay_Vb3kT9wQ2mXr7LpN5sZe \
  -H "Authorization: Bearer $WC_SECRET_KEY"
```

```ts
import type { PaymentObject } from "@whitechain-commerce/react/server";

const res = await fetch("https://whitechain-dashboard.vercel.app/api/v1/payments?limit=50", {
  headers: { Authorization: `Bearer ${process.env.WC_SECRET_KEY}` },
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const { data } = (await res.json()) as { data: PaymentObject[] };
const paid = data.find((p) => p.orderId === "order_1042");
```

There is no cursor pagination and no filter by order. If you need older payments than the latest 100, use the CSV export in the dashboard. Details in the [API reference](./api-reference.md#list-payments).

## Late payments

The checkout widget stops offering payment once a session expires, but the router has no expiry. A customer can still complete a `pay()` transaction for an expired session, for example one signed just before the deadline and mined after it.

Funds have already moved to your payout wallet by then, so the indexer records the payment anyway:

- The session becomes `paid`, even if it was `expired`.
- A normal `payment.succeeded` webhook is sent.
- If the block time is more than 10 minutes after `expiresAt`, a warning is written to the server log. Nothing in the API marks the payment as late.

If you cancelled the order when the session expired, handle a later `payment.succeeded` for it by fulfilling the order anyway or by refunding it. If you created a fresh session for the same `orderId` in the meantime, both sessions can end up paid, so check for a second payment on the same `orderId`.

## Wrong amounts

The router accepts any non-zero amount for an order, so a customer using their own tooling could pay a different amount than the session asked for. The widget always pays exactly `amountUnits`.

When the amount differs from the session's `amountUnits`, more or less:

- No payment is recorded and no webhook is sent.
- If the session was `open` or `processing`, it is set to `expired`. Its onchain order id is now used up (the router allows one payment per order), so the session could never be paid correctly.
- The next `POST /api/v1/checkout_sessions` for the same `orderId` creates a fresh session with a new onchain order id.
- The USDT has still moved to your payout wallet. It does not appear in the API or the dashboard, and the dashboard refund flow cannot return it because there is no payment record. The router did record the payment onchain, so your payout wallet can still return it by calling `refund(paymentId, amount)` on the router directly, with `paymentId = keccak256(abi.encode(chainMerchantId, chainOrderId))` (the `paymentId` in the `PaymentSettled` event). The indexer ignores that `Refunded` event, because there is no payment record to attach it to.

## Limitations

- Payments settle only in USDT on Whitechain Sepolia. There is no live mode.
- A payment always pays a checkout session. Each visit to a reusable payment link creates a new session.
- `createdAt` is the time the payment was indexed, not the block time. Use `txHash` on the explorer for the exact block.
