# Checkout sessions

A checkout session is a request to pay a fixed USDT amount for one of your orders, valid for 30 minutes.

You create a session on your server, then send the customer to pay it, either with the embedded `<WhitechainCheckout />` widget or by redirecting to the hosted checkout page in `session.url`. The customer pays from their own wallet straight to your payout wallet. Once the indexer has validated the payment onchain, the session becomes `paid`, a [payment](./payments.md) is recorded and a `payment.succeeded` webhook is sent.

## Before you start

- Your merchant account is active and you have a secret key (`sk_test_...`) from the dashboard.
- You have registered a payout wallet in the dashboard. Without it, session creation fails with `409 conflict`.
- You have a webhook endpoint, because webhooks are how you should fulfil orders. See [Webhooks](./webhooks.md).

## Create a session

Create the session on your server, with an amount you computed yourself, never one sent by the browser.

```ts
// app/api/orders/route.ts (Next.js route handler)
import { createCheckoutSession } from "@whitechain-commerce/react/server";

export async function POST() {
  const orderId = `order_${crypto.randomUUID()}`;
  const session = await createCheckoutSession({
    apiBase: process.env.WC_API_BASE, // e.g. "http://localhost:3000"
    secretKey: process.env.WC_SECRET_KEY!,
    orderId,
    amount: "49.99",
    successUrl: `https://shop.example.com/orders/${orderId}`,
    cancelUrl: "https://shop.example.com/cart",
    metadata: { cartSize: "3" },
  });
  return Response.json({ orderId, sessionId: session.id, url: session.url });
}
```

Or call the API directly:

```bash
curl -X POST http://localhost:3000/api/v1/checkout_sessions \
  -H "Authorization: Bearer $WC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "orderId": "order_1042", "amount": "49.99" }'
```

Then either render the widget with `session.id`, or redirect the customer to `session.url`. See [Checkout widget](./checkout-widget.md) and [Hosted checkout](./hosted-checkout.md).

The full request schema and response object are in the [API reference](./api-reference.md#create-a-checkout-session).

## Lifecycle

A session has one of four statuses:

| Status | Meaning |
| --- | --- |
| `open` | Waiting for payment. |
| `processing` | The widget reported a transaction hash and the platform is confirming it. Nothing is guaranteed yet. |
| `paid` | A valid payment was recorded. Final. |
| `expired` | The session can no longer be used. Create a new one if the customer still wants to pay. |

```
           submit hint                valid payment indexed
  open ───────────────▶ processing ──────────────────────────▶ paid
   │                       │
   │ 30 minutes pass       │ hinted tx did not pay this session
   ▼                       ▼
 expired ◀──────────── open / expired
```

Transitions as implemented:

| From | To | When |
| --- | --- | --- |
| `open` | `processing` | `POST /checkout_sessions/:id/submit` is called with a transaction hash. |
| `open` | `expired` | The session is read through `GET /checkout_sessions/:id` after `expiresAt`. Expiry is applied lazily on read, so a session can stay `open` in the database past `expiresAt` until something reads it. |
| `processing` | `open` | The indexer finds that the hinted transaction was mined but did not pay this session (reverted, wrong contract, someone else's payment), or the node does not know the transaction at all. |
| `processing` | `expired` | Same as above but more than 10 minutes after `expiresAt`, or the hinted transaction never landed and the session is more than 10 minutes past `expiresAt`. |
| `open`, `processing` | `expired` | A payment for this session's onchain order arrived with the wrong amount. See [Wrong amounts](./payments.md#wrong-amounts). |
| `open`, `processing`, `expired` | `paid` | The indexer recorded a valid payment for the session, including a late one. |

A `processing` session does not expire on a timer. It leaves `processing` only through the indexer's checks.

## Expiry

Sessions expire 30 minutes after creation. `expiresAt` holds the exact time, and the widget shows a countdown.

Expiry is about what the platform offers, not what the chain allows. The PaymentRouter has no notion of expiry, so a customer who submits a payment just before or after `expiresAt` still pays you onchain. That payment is recorded and the session becomes `paid`. See [Late payments](./payments.md#late-payments).

## One session, one onchain order

Each session gets its own onchain order id: `chainOrderId = keccak256(session.id)`. Your merchant id maps to `chainMerchantId = keccak256(merchant.id)`. The customer's wallet calls:

```solidity
pay(chainMerchantId, chainOrderId, amountUnits)
```

The router accepts at most one payment per `(chainMerchantId, chainOrderId)` and reverts a second one with `AlreadyPaid`. So a session can never be paid twice.

Your `orderId` is not sent onchain. It links sessions and payments back to your system.

## Idempotent re-creation

Creating a session is idempotent per `orderId`. When you call `POST /api/v1/checkout_sessions` for an `orderId` that already has sessions, the API checks them in this order:

1. If any session for this `orderId` has a payment, it returns `409 conflict` (`Order <orderId> has already been paid.`).
2. If a session with the same amount is `processing`, or `open` with `expiresAt` still in the future, it returns that session with `200 OK`. Nothing new is created.
3. If a session with a different amount is `processing`, it returns `409 conflict` (`A payment for order <orderId> is already being processed.`).
4. Otherwise it creates a new session and returns `201 Created`.

Concurrent requests for the same order are serialized, so a retried request cannot create a second payable session for the same order and amount.

This means you can safely call create again when the customer reloads the checkout, and you get a fresh session automatically once the previous one has expired.

Things to know:

- "Same amount" compares base units, so `"5"` and `"5.00"` are the same amount.
- If you change the amount for an order (for example the cart changed), a new session is created, but an earlier `open` session for the old amount is not cancelled. It stays payable until it expires. Use a new `orderId` when the cart changes if you want to avoid this.
- The "already paid" check runs only when you create a session. If an expired session is paid late (see [Expiry](#expiry)) after you created a fresh session for the same `orderId`, and the fresh one is paid too, the order ends up with two payments. Check `orderId` in your `payment.succeeded` handler and refund a duplicate.

## Amounts and decimals

Amounts are decimal strings in whole USDT:

| Input | Accepted | Stored `amount` | `amountUnits` |
| --- | --- | --- | --- |
| `"49.99"` | Yes | `"49.99"` | `"49990000"` |
| `"5"` | Yes | `"5.00"` | `"5000000"` |
| `"1.234567"` | Yes | `"1.234567"` | `"1234567"` |
| `"0.000001"` | Yes | `"0.000001"` | `"1"` |
| `"1.1234567"` | No, more than 6 decimals | | |
| `"0"` | No, must be positive | | |
| `49.99` (number) | No, must be a string | | |
| `"1,000.00"`, `"-5"`, `"1e3"`, `" 5"` | No, pattern is `^\d+(\.\d+)?$` | | |

The server reads the token's `decimals()` onchain (6 for USDT) and converts the amount to base units. The customer must pay exactly `amountUnits`, no more and no less. Amount strings are capped at 40 characters.

The response `amount` is normalized to at least 2 decimals. Use `amountUnits` when you compare amounts in code.

Only USDT is supported. `currency` is optional and must be `"USDT"` when present.

## Metadata

Attach up to 20 string key-value pairs to a session, for example your customer or cart id:

```json
{ "metadata": { "customerId": "cus_88", "cartSize": "3" } }
```

| Rule | Limit |
| --- | --- |
| Keys | At most 20 |
| Key length | At most 40 characters |
| Value length | At most 500 characters |
| Value type | Strings only |

Metadata is returned in the `CheckoutSession` from the create call. It is not part of the public session view, and it is not included in `PaymentObject` or webhook payloads. Look it up by `orderId` or `sessionId` in your own system if you need it after payment.

## Success and cancel URLs

Both are optional `http` or `https` URLs, at most 2048 characters.

| Field | Hosted checkout | Embedded widget |
| --- | --- | --- |
| `successUrl` | After a confirmed payment, the page redirects there after about 2 seconds. If the session was already paid when the page loaded, it shows a "Return to store" link instead. | The success screen shows a "Return to store" link. The URL is also passed to `onSuccess` as `successUrl`; the widget does not redirect on its own. |
| `cancelUrl` | The Cancel button and the expired screen link there. | Same, unless you pass `onCancel`, which takes over the Cancel button. |

Reaching `successUrl` does not prove payment, because anyone can open it. Fulfil orders from the verified `payment.succeeded` webhook. See [Webhooks](./webhooks.md).

## The submit hint

```
POST /api/v1/checkout_sessions/:id/submit   { "txHash": "0x..." }
```

The widget calls this right after the customer's wallet broadcasts `pay()`, and retries once after 3 seconds if the call fails. It is public, so the platform treats it as a hint and nothing more:

- It stores the hash and moves an `open` session to `processing`.
- It asks the indexer to validate that transaction now, and waits up to 6 seconds. Validation waits for the transaction to have 1 confirmation.
- It never marks the session `paid` itself. Only a payment that passes every [settlement check](./payments.md#how-a-payment-is-created) does that, whether it comes from this call or from the regular indexer pass.
- A bogus or failed hash cannot block a session: the indexer moves the session back to `open` (or `expired`) once it sees the hash did not pay it.

If the call never happens (the customer closes the tab, the network drops), the regular indexer pass still finds the payment onchain. You do not need to call this endpoint yourself unless you build your own checkout UI.

## Read a session

```bash
curl http://localhost:3000/api/v1/checkout_sessions/cs_Q3n8ZpK2vRt6YxLm4WbH
```

This is the public view the widget polls. It has no authentication and does not include `url`, `metadata` or `createdAt`. There is no authenticated endpoint to retrieve or list sessions, and no endpoint to cancel one. See the [API reference](./api-reference.md#retrieve-a-checkout-session-public).

## Building your own checkout

If you do not use the widget, your page needs to:

1. Read the public session for `routerAddress`, `tokenAddress`, `chainMerchantId`, `chainOrderId` and `amountUnits`.
2. Have the customer's wallet call `approve(routerAddress, amountUnits)` on the USDT token if the allowance is too low.
3. Have it call `pay(chainMerchantId, chainOrderId, amountUnits)` on the router, on chain `1874`.
4. Post the transaction hash to `/submit`.
5. Poll the session until `status` is `paid` (or `expired`, or back to `open` if the transaction failed).
