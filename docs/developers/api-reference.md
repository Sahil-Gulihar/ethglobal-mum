---
title: "API reference"
description: "Every HTTP endpoint under /api/v1, with request schemas, response objects and status codes as implemented."
---

The API is small on purpose. Your server creates checkout sessions and refund requests and reads payments. The checkout widget reads a public view of a session and reports the transaction hash it sent. Money never moves through the API: payments go from the customer's wallet to your payout wallet through the PaymentRouter contract, and refunds are signed by your payout wallet.

## Base URL

The hosted API base URL is:

```
https://100lana.com/api/v1
```

Use the API origin shown under **Developers** in your dashboard. For hosted checkout, redirect to the URL returned in `CheckoutSession.url`.

| Resource | Value |
| --- | --- |
| Chain ID | `1874` (`0x752`) |
| PaymentRouter | `0xa99a6D97607567f4fe734831910D24f4e9BD0508` |
| USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, 6 decimals |
| Explorer | https://explorer.testnet.whitechain.io |
| Public RPC | https://rpc.testnet.whitechain.io |

## Authentication

Authenticated endpoints take a secret key in the `Authorization` header:

```
Authorization: Bearer sk_test_...
```

Create and revoke keys in the dashboard under Developers. The full key is shown once; the server stores only its SHA-256 hash.

A request is rejected with `401 authentication` when:

- the header is missing or not of the form `Bearer sk_test_<letters and digits>`,
- the key does not exist or has been revoked,
- the merchant account that owns the key is not `active`.

Two endpoints are public because the checkout widget calls them from the customer's browser:

| Endpoint | Auth |
| --- | --- |
| `POST /api/v1/checkout_sessions` | Secret key |
| `GET /api/v1/checkout_sessions/:id` | None (public) |
| `POST /api/v1/checkout_sessions/:id/submit` | None (public) |
| `GET /api/v1/payments` | Secret key |
| `GET /api/v1/payments/:id` | Secret key |
| `POST /api/v1/refunds` | Secret key |
| `GET /api/v1/refunds` | Secret key |

The public endpoints return no secrets: no metadata, no keys, and no other sessions or payments. Anyone who knows a session id can read its public view and post a transaction hash hint, which is why a hint never marks a session paid on its own (see [Checkout sessions](./checkout-sessions.md#the-submit-hint)).

Keep secret keys on your server. CORS is open (below), so the API would accept a key sent from a browser, but anyone could then read it from your page.

## CORS

Every `/api/v1` response, including errors, carries:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

Every `/api/v1` route answers `OPTIONS` preflight requests with `204 No Content`, the headers above and `Access-Control-Max-Age: 86400`.

## Requests and responses

- Send request bodies as JSON. The body is parsed as JSON whatever the `Content-Type`, but send `Content-Type: application/json` anyway.
- A body that is not valid JSON returns `400 invalid_request` with the message `Request body must be valid JSON.`
- Responses are JSON. Errors use one envelope, described in [Errors](./errors.md):

```json
{ "error": { "type": "invalid_request", "message": "amount: must be a decimal string like \"49.99\"" } }
```

- Amounts are decimal strings in whole USDT, for example `"49.99"`. They are never numbers, so no precision is lost. See [Amounts](./checkout-sessions.md#amounts-and-decimals).
- Timestamps are ISO 8601 strings in UTC, for example `"2026-11-06T10:15:00.000Z"`.
- Onchain values (addresses, hashes, ids) are `0x`-prefixed hex strings. Transaction hashes, `chainMerchantId`, `chainOrderId` and `chainPaymentId` are lowercase. Addresses are returned as stored, so compare them case-insensitively.

## Idempotency

There is no `Idempotency-Key` header. Idempotency is built into the resources instead:

- **Checkout sessions** are idempotent per `orderId`. Creating a session again for the same `orderId` and the same amount, while the earlier session is still `processing` or `open` and unexpired, returns that session with `200 OK` instead of `201 Created`. Concurrent creates for the same order are serialized, so retries cannot produce two payable sessions for the same order and amount. Details in [Checkout sessions](./checkout-sessions.md#idempotent-re-creation).
- **Payments** are created only by the indexer, at most once per session.
- **Refunds** are not idempotent. Each `POST /api/v1/refunds` creates a new pending refund and reserves its amount. Do not blindly retry a refund request that may have succeeded; list the payment's refunds first.

## Pagination and limits

There is no cursor pagination. List endpoints return the newest items first, up to a limit.

| Endpoint | Limit |
| --- | --- |
| `GET /api/v1/payments` | `limit` query parameter, integer from 1 to 100, default 20 |
| `GET /api/v1/refunds` | Fixed at 100, not configurable |

For longer history, the dashboard can export payments and succeeded refunds as CSV.

There is no rate limiting on the API itself.

---

## Create a checkout session

```
POST /api/v1/checkout_sessions
```

Auth: secret key.

Creates a checkout session for one of your orders. Call this from your server, so the customer cannot change the amount. Sessions expire 30 minutes after creation.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `orderId` | string | Yes | Your own order id. Leading and trailing whitespace is trimmed. 1 to 200 characters after trimming. |
| `amount` | string | Yes | Decimal USDT amount, matching `^\d+(\.\d+)?$`, at most 40 characters. Must be greater than zero and have at most 6 decimal places (the token's onchain `decimals()`). |
| `currency` | string | No | Only `"USDT"` is accepted. |
| `successUrl` | string or null | No | Where the hosted checkout sends the customer after a confirmed payment. Must be an `http` or `https` URL, at most 2048 characters. |
| `cancelUrl` | string or null | No | Where the widget's Cancel button and the expired screen send the customer. Same rules as `successUrl`. |
| `metadata` | object or null | No | String-to-string map stored with the session. Keys at most 40 characters, values at most 500 characters, at most 20 keys. Values must be strings. |
| `requireVerifiedBuyer` | boolean | No | `true` makes the buyer prove they're human before they can pay. See [Verified buyers](./verified-buyers.md). Default `false`. |
| `verifiedBuyerMethod` | string | No | `"world_id"` (default) or `"zg"` (0G picture check). Only used with `requireVerifiedBuyer: true`. |

The merchant account must have a payout wallet registered onchain. Otherwise the request fails with `409 conflict` (see [Errors](./errors.md#conflict)).

### Response

`201 Created` with a [CheckoutSession](#checkoutsession) when a new session was created.

`200 OK` with the existing [CheckoutSession](#checkoutsession) when an equivalent session already exists for this `orderId` (same amount, still `processing` or `open` and unexpired).

### Status codes

| Status | Type | When |
| --- | --- | --- |
| 201 | | New session created |
| 200 | | Existing session returned (idempotent re-create) |
| 400 | `invalid_request` | Body is not JSON, fails validation, amount is zero or has too many decimals |
| 401 | `authentication` | Missing, invalid or revoked key, or inactive merchant |
| 409 | `conflict` | No payout wallet registered, order already paid, or another payment for the order is being processed |
| 500 | `server_error` | Unexpected error |

### Example

```bash
curl -X POST https://100lana.com/api/v1/checkout_sessions \
  -H "Authorization: Bearer $WC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_1042",
    "amount": "49.99",
    "currency": "USDT",
    "successUrl": "https://shop.example.com/orders/order_1042",
    "cancelUrl": "https://shop.example.com/cart",
    "metadata": { "customerId": "cus_88" }
  }'
```

```json
{
  "id": "cs_Q3n8ZpK2vRt6YxLm4WbH",
  "status": "open",
  "merchant": { "name": "Chai & Co." },
  "orderId": "order_1042",
  "amount": "49.99",
  "amountUnits": "49990000",
  "currency": "USDT",
  "decimals": 6,
  "chainId": 1874,
  "routerAddress": "0xa99a6D97607567f4fe734831910D24f4e9BD0508",
  "tokenAddress": "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  "chainMerchantId": "0xa65fb120a3b9e9a9ffbfff63fa7b84676fbc256b68a2448e22f5aad57e83d6e1",
  "chainOrderId": "0x4e03aae7bd5a2c096c69ac1a4f01de6920f219fdf1ac89caec7efc539937f2ff",
  "expiresAt": "2026-11-06T10:45:00.000Z",
  "successUrl": "https://shop.example.com/orders/order_1042",
  "cancelUrl": "https://shop.example.com/cart",
  "payment": null,
  "url": "https://100lana.com/checkout/cs_Q3n8ZpK2vRt6YxLm4WbH",
  "metadata": { "customerId": "cus_88" },
  "createdAt": "2026-11-06T10:15:00.000Z"
}
```

From TypeScript, the server helper in the React SDK wraps this endpoint:

```ts
import { createCheckoutSession } from "@whitechain-commerce/react/server";

const session = await createCheckoutSession({
  apiBase: "https://100lana.com",
  secretKey: process.env.WC_SECRET_KEY!,
  orderId: "order_1042",
  amount: "49.99",
  successUrl: "https://shop.example.com/orders/order_1042",
  cancelUrl: "https://shop.example.com/cart",
  metadata: { customerId: "cus_88" },
});
// session.id -> pass to <WhitechainCheckout sessionId={...} />, or redirect to session.url
```

`apiBase` falls back to `NEXT_PUBLIC_WC_API_BASE` when omitted. The helper always sends `currency: "USDT"` and checks a few things before calling the API (key starts with `sk_`, `orderId` is set, `amount` is a positive decimal with at most 6 decimals, an API base is known). Failures throw `WhitechainApiError` with `status` and `type`; see [Errors](./errors.md#errors-in-the-sdk).

## Retrieve a checkout session (public)

```
GET /api/v1/checkout_sessions/:id
```

Auth: none.

Returns the public view of a session. The checkout widget polls this every 2 seconds while it waits for confirmation. If the session is `open`, has no payment and its `expiresAt` has passed, this call marks it `expired` before answering.

There is no authenticated "retrieve session" endpoint. The full [CheckoutSession](#checkoutsession) (with `url`, `metadata` and `createdAt`) is returned only by the create call. To learn that an order was paid, listen for the `payment.succeeded` webhook or list payments.

### Status codes

| Status | Type | When |
| --- | --- | --- |
| 200 | | Session found |
| 404 | `not_found` | No session with that id |
| 500 | `server_error` | Unexpected error |

### Example

```bash
curl https://100lana.com/api/v1/checkout_sessions/cs_Q3n8ZpK2vRt6YxLm4WbH
```

```json
{
  "id": "cs_Q3n8ZpK2vRt6YxLm4WbH",
  "status": "paid",
  "merchant": { "name": "Chai & Co." },
  "orderId": "order_1042",
  "amount": "49.99",
  "amountUnits": "49990000",
  "currency": "USDT",
  "decimals": 6,
  "chainId": 1874,
  "routerAddress": "0xa99a6D97607567f4fe734831910D24f4e9BD0508",
  "tokenAddress": "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  "chainMerchantId": "0xa65fb120a3b9e9a9ffbfff63fa7b84676fbc256b68a2448e22f5aad57e83d6e1",
  "chainOrderId": "0x4e03aae7bd5a2c096c69ac1a4f01de6920f219fdf1ac89caec7efc539937f2ff",
  "expiresAt": "2026-11-06T10:45:00.000Z",
  "successUrl": "https://shop.example.com/orders/order_1042",
  "cancelUrl": "https://shop.example.com/cart",
  "payment": {
    "id": "pay_Vb3kT9wQ2mXr7LpN5sZe",
    "txHash": "0xca1467eb1d7b29899ff948051bd8cd21e1c4581e9e60d6d9cbc0ccf74e97e9b4",
    "explorerUrl": "https://explorer.testnet.whitechain.io/tx/0xca1467eb1d7b29899ff948051bd8cd21e1c4581e9e60d6d9cbc0ccf74e97e9b4"
  }
}
```

## Submit a transaction hash (public)

```
POST /api/v1/checkout_sessions/:id/submit
```

Auth: none.

The checkout widget calls this after the customer's `pay` transaction is broadcast. It is a hint that speeds up confirmation. It never marks a session paid by itself: only a payment that passes the indexer's checks does that (see [Payments](./payments.md#how-a-payment-is-created)).

What it does:

1. If the session is already `paid`, it changes nothing and returns `paid`.
2. Otherwise it stores the hash (replacing any earlier hint) and moves an `open` session to `processing`. `processing` and `expired` sessions keep their status.
3. It runs the indexer's validation on that transaction and waits up to 6 seconds for it. If the transaction is already confirmed and valid, the session is `paid` by the time the response is sent.
4. It returns the session's current status.

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `txHash` | string | Yes | `0x` followed by 64 hex characters. Stored in lowercase. |

### Response

`200 OK`:

| Field | Type | Description |
| --- | --- | --- |
| `ok` | `true` | Always `true` on success. |
| `status` | string | The session status after the call: `open`, `processing`, `paid` or `expired`. |

### Status codes

| Status | Type | When |
| --- | --- | --- |
| 200 | | Hint stored (or session already paid) |
| 400 | `invalid_request` | Body is not JSON or `txHash` is malformed |
| 404 | `not_found` | No session with that id |
| 500 | `server_error` | Unexpected error |

### Example

```bash
curl -X POST https://100lana.com/api/v1/checkout_sessions/cs_Q3n8ZpK2vRt6YxLm4WbH/submit \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0xca1467eb1d7b29899ff948051bd8cd21e1c4581e9e60d6d9cbc0ccf74e97e9b4" }'
```

```json
{ "ok": true, "status": "processing" }
```

## List payments

```
GET /api/v1/payments
```

Auth: secret key.

Returns your payments, newest first.

### Query parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | integer | No | 1 to 100. Default 20. Anything else (including an empty value or a decimal) returns `400`. |

### Response

`200 OK`:

| Field | Type | Description |
| --- | --- | --- |
| `data` | [PaymentObject](#paymentobject)[] | Payments ordered by `createdAt` descending. |

### Status codes

| Status | Type | When |
| --- | --- | --- |
| 200 | | Success, possibly an empty list |
| 400 | `invalid_request` | `limit must be an integer between 1 and 100.` |
| 401 | `authentication` | Missing, invalid or revoked key, or inactive merchant |
| 500 | `server_error` | Unexpected error |

### Example

```bash
curl "https://100lana.com/api/v1/payments?limit=2" \
  -H "Authorization: Bearer $WC_SECRET_KEY"
```

```json
{
  "data": [
    {
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
  ]
}
```

## Retrieve a payment

```
GET /api/v1/payments/:id
```

Auth: secret key.

Returns one [PaymentObject](#paymentobject). Payments of other merchants return `404`, the same as ids that do not exist.

### Status codes

| Status | Type | When |
| --- | --- | --- |
| 200 | | Payment found |
| 401 | `authentication` | Missing, invalid or revoked key, or inactive merchant |
| 404 | `not_found` | `No payment <id>.` |
| 500 | `server_error` | Unexpected error |

### Example

```bash
curl https://100lana.com/api/v1/payments/pay_Vb3kT9wQ2mXr7LpN5sZe \
  -H "Authorization: Bearer $WC_SECRET_KEY"
```

The response is a single [PaymentObject](#paymentobject), as in the list example.

## Create a refund

```
POST /api/v1/refunds
```

Auth: secret key.

Creates a `pending` refund request for a payment. The API cannot move funds. The refund completes when you sign it from your payout wallet in the dashboard and the indexer sees the onchain `Refunded` event. See [Refunds](./refunds.md).

### Request body

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `paymentId` | string | Yes | A `pay_...` id that belongs to you. Trimmed, 1 to 100 characters. |
| `amount` | string | Yes | Decimal USDT amount, matching `^\d+(\.\d+)?$`, at most 40 characters. Greater than zero, at most 6 decimal places, and no more than the refundable balance. |

The refundable balance is the payment amount minus what has already been refunded onchain minus every other `pending` refund for the payment.

### Response

`201 Created` with a [RefundObject](#refundobject) whose `status` is `pending` and `txHash` is `null`.

### Status codes

| Status | Type | When |
| --- | --- | --- |
| 201 | | Pending refund created |
| 400 | `invalid_request` | Body is not JSON, fails validation, amount is zero, has too many decimals, or exceeds the refundable balance |
| 401 | `authentication` | Missing, invalid or revoked key, or inactive merchant |
| 404 | `not_found` | `No payment <paymentId>.` |
| 500 | `server_error` | Unexpected error |

### Example

```bash
curl -X POST https://100lana.com/api/v1/refunds \
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

## List refunds

```
GET /api/v1/refunds
```

Auth: secret key.

Returns your refunds, newest first, at most 100.

### Query parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `paymentId` | string | No | Only refunds of this payment. An unknown id returns an empty list, not `404`. An empty value (`?paymentId=`) is ignored and returns all your refunds. |

### Response

`200 OK`:

| Field | Type | Description |
| --- | --- | --- |
| `data` | [RefundObject](#refundobject)[] | Refunds ordered by `createdAt` descending. Includes `pending` and `succeeded` refunds. Discarded pending refunds are deleted and do not appear. |

### Status codes

| Status | Type | When |
| --- | --- | --- |
| 200 | | Success, possibly an empty list |
| 401 | `authentication` | Missing, invalid or revoked key, or inactive merchant |
| 500 | `server_error` | Unexpected error |

### Example

```bash
curl "https://100lana.com/api/v1/refunds?paymentId=pay_Vb3kT9wQ2mXr7LpN5sZe" \
  -H "Authorization: Bearer $WC_SECRET_KEY"
```

```json
{
  "data": [
    {
      "id": "re_Jt6pW2nR8vKx3QmY9cLa",
      "paymentId": "pay_Vb3kT9wQ2mXr7LpN5sZe",
      "orderId": "order_1042",
      "amount": "10.00",
      "currency": "USDT",
      "status": "succeeded",
      "txHash": "0x4104654031bd074fbae534380065dad4116c4d62f706858cf10491af9e635d29",
      "explorerUrl": "https://explorer.testnet.whitechain.io/tx/0x4104654031bd074fbae534380065dad4116c4d62f706858cf10491af9e635d29",
      "createdAt": "2026-11-06T11:02:40.000Z"
    }
  ]
}
```

---

## Objects

Types come from `@whitechain-commerce/core` (`packages/core/src/types.ts` and `packages/core/src/webhooks.ts`).

### PublicCheckoutSession

Returned by `GET /api/v1/checkout_sessions/:id`. Safe to show in a browser.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Session id, `cs_` followed by 20 letters and digits. |
| `status` | `"open"` \| `"processing"` \| `"paid"` \| `"expired"` | See [Session lifecycle](./checkout-sessions.md#lifecycle). |
| `merchant` | `{ name: string }` | Your business name as set in the dashboard. |
| `orderId` | string | Your order id, as sent (trimmed). |
| `amount` | string | Normalized decimal amount with at least 2 decimals, for example `"5.00"` for an input of `"5"`. |
| `amountUnits` | string | Amount in token base units as an integer string, for example `"49990000"` for 49.99 USDT. This is the exact value the customer must pay. |
| `currency` | `"USDT"` | Always USDT. |
| `decimals` | number | Token decimals used to price the session, read onchain at creation. `6` for USDT. |
| `chainId` | `1874` | Settlement chain ID. |
| `routerAddress` | string | PaymentRouter address the customer pays through. |
| `tokenAddress` | string | USDT token address. |
| `chainMerchantId` | string | `keccak256` of your merchant id (UTF-8), the `merchantId` argument of `pay()`. |
| `chainOrderId` | string | `keccak256` of the session id (UTF-8), the `orderId` argument of `pay()`. One session maps to one onchain order. |
| `expiresAt` | string | ISO timestamp, 30 minutes after creation. |
| `successUrl` | string \| null | As set on creation. |
| `cancelUrl` | string \| null | As set on creation. |
| `payment` | object \| null | `null` until a payment is recorded. Then `{ id, txHash, explorerUrl }` of that payment. |

### CheckoutSession

Returned by `POST /api/v1/checkout_sessions`. All fields of [PublicCheckoutSession](#publiccheckoutsession), plus:

| Field | Type | Description |
| --- | --- | --- |
| `url` | string | Full URL to the hosted checkout page. |
| `metadata` | object \| null | Your metadata, or `null`. |
| `createdAt` | string | ISO timestamp of creation. |

On the create response, `payment` is always `null`.

### PaymentObject

Returned by the payments endpoints and inside webhook events.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Payment id, `pay_` followed by 20 letters and digits. |
| `sessionId` | string | The checkout session it paid. |
| `orderId` | string | Your order id from that session. |
| `amount` | string | Amount paid, decimal string with at least 2 decimals. Always equal to the session amount. |
| `amountRefunded` | string | Total refunded onchain so far, for example `"0.00"`. Pending refunds are not included. |
| `currency` | `"USDT"` | Always USDT. |
| `status` | `"succeeded"` \| `"partially_refunded"` \| `"refunded"` | `succeeded` until the first refund, `partially_refunded` while `amountRefunded` is above zero and below `amount`, `refunded` once it reaches `amount`. |
| `payer` | string | Address that sent the payment. Refunds go back to this address. |
| `txHash` | string | Transaction that emitted `PaymentSettled`, lowercase. |
| `explorerUrl` | string | `https://explorer.testnet.whitechain.io/tx/<txHash>`. |
| `chainId` | `1874` | Settlement chain ID. |
| `chainPaymentId` | string | Onchain payment id, `keccak256(abi.encode(chainMerchantId, chainOrderId))`, lowercase. The first argument of `refund()`. |
| `createdAt` | string | ISO timestamp of when the payment was recorded by the indexer (not the block time). |

### RefundObject

Returned by the refunds endpoints and inside `refund.succeeded` events.

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Refund id, `re_` followed by 20 letters and digits. |
| `paymentId` | string | The refunded payment. |
| `orderId` | string | Your order id. |
| `amount` | string | Refund amount, decimal string with at least 2 decimals. |
| `currency` | `"USDT"` | Always USDT. |
| `status` | `"pending"` \| `"succeeded"` | `pending` until the onchain refund is indexed, then `succeeded`. |
| `txHash` | string \| null | Refund transaction, lowercase. `null` while pending. |
| `explorerUrl` | string \| null | Explorer link for `txHash`, or `null`. |
| `createdAt` | string | ISO timestamp. For a request made through the API or dashboard, when the request was created. For a refund made without a request, when the indexer recorded it. |

## Not available

These do not exist in the API today: an authenticated session retrieve or list endpoint, session cancel or expire endpoints, refund retrieve by id, refund cancel through the API (discard pending refunds in the dashboard), payment links, subscriptions, and webhook endpoint management through the API (use the dashboard).
