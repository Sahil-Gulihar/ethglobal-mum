---
title: "Errors"
description: "How the API reports failures, every error type it returns, and the usual causes."
---

## Error envelope

Every `/api/v1` error has the same JSON shape and the right HTTP status:

```json
{
  "error": {
    "type": "conflict",
    "message": "Order order_1042 has already been paid."
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `error.type` | string | One of `invalid_request`, `authentication`, `not_found`, `conflict`, `server_error`. Branch on this. |
| `error.message` | string | Human-readable explanation. Safe to log, not meant to be parsed. |

Error responses carry the same CORS headers as successful ones, so browser code can read them.

## Error types

| Type | HTTP status | Meaning |
| --- | --- | --- |
| `invalid_request` | 400 | The request is malformed or breaks a validation rule. Fix the request before retrying. |
| `authentication` | 401 | The secret key is missing, malformed, revoked, or belongs to an inactive merchant. |
| `not_found` | 404 | The session or payment does not exist, or the payment belongs to another merchant. |
| `conflict` | 409 | The request is valid but the current state does not allow it. |
| `server_error` | 500 | Something failed on the server. Safe to retry with backoff. |

The `/api/v1` route handlers return no other statuses. There are no `403`, `422` or `429` responses. A request with an HTTP method a route does not implement (for example `DELETE`) is answered by Next.js itself with `405`, without the error envelope or CORS headers.

## invalid_request

Returned with `400`.

**Body is not JSON.** Message: `Request body must be valid JSON.`

**Schema validation failed.** The message lists every problem as `<field>: <reason>`, separated by `; `. For example:

```json
{ "error": { "type": "invalid_request", "message": "amount: must be a decimal string like \"49.99\"" } }
```

Common causes:

| Cause | Field | Notes |
| --- | --- | --- |
| Amount sent as a number, or with a comma, sign, spaces or exponent | `amount` | Send a string such as `"49.99"`. The pattern is `^\d+(\.\d+)?$`. |
| Amount longer than 40 characters | `amount` | |
| Missing or empty `orderId`, or longer than 200 characters | `orderId` | Whitespace is trimmed before the length check. |
| `currency` other than `"USDT"` | `currency` | Omit it or send `"USDT"`. |
| `successUrl` or `cancelUrl` not an `http` or `https` URL, or longer than 2048 characters | `successUrl`, `cancelUrl` | |
| `metadata` with more than 20 keys, a key over 40 characters, a value over 500 characters, or a non-string value | `metadata` | Convert numbers and booleans to strings. |
| `txHash` not `0x` plus 64 hex characters | `txHash` | Message: `must be a 0x-prefixed 32-byte hex tx hash`. |
| Missing or empty `paymentId`, or longer than 100 characters | `paymentId` | |

**Amount is zero.** `"0"` and `"0.00"` match the pattern but are rejected after parsing. Message: `Invalid amount: Amount must be positive`.

**Too many decimals.** USDT has 6 decimals. Message, for example: `Invalid amount: Amount 1.1234567 has more than 6 decimals`.

**Refund exceeds the refundable balance.** The refundable balance is the payment amount, minus what was refunded onchain, minus every other pending refund for that payment. Message, for example:

```
Refund amount exceeds the refundable balance (39.99 USDT available after refunds and pending refunds).
```

If a pending refund is holding the balance and you no longer want it, discard it in the dashboard (see [Refunds](./refunds.md#discarding-a-pending-refund)).

**Invalid `limit`.** On `GET /api/v1/payments`. Message: `limit must be an integer between 1 and 100.`

## authentication

Returned with `401`. Message: ``Missing or invalid API key. Send `Authorization: Bearer sk_test_...`.``

Common causes:

- No `Authorization` header, or a scheme other than `Bearer`.
- A key that does not start with `sk_test_` or contains characters other than letters and digits after it (for example a stray quote or newline from a `.env` file).
- A revoked key.
- The merchant account is not `active`.

Only the endpoints that need a secret key return this error. The public session endpoints never do.

## not_found

Returned with `404`.

| Endpoint | Message |
| --- | --- |
| `GET /api/v1/checkout_sessions/:id` | `No checkout session <id>.` |
| `POST /api/v1/checkout_sessions/:id/submit` | `No checkout session <id>.` |
| `GET /api/v1/payments/:id` | `No payment <id>.` |
| `POST /api/v1/refunds` | `No payment <paymentId>.` |

A payment that belongs to another merchant is reported as not found. `GET /api/v1/refunds?paymentId=...` with an unknown id returns an empty list instead of `404`.

## conflict

Returned with `409` by `POST /api/v1/checkout_sessions`.

| Message | Cause | What to do |
| --- | --- | --- |
| `No payout address registered. Set your payout wallet in the dashboard before creating checkout sessions.` | The merchant has no payout wallet registered onchain yet. | Add a payout wallet under Settings in the dashboard and wait for the registration to confirm. |
| `Order <orderId> has already been paid.` | A session for this `orderId` already has a recorded payment. | Do not charge again. Look the payment up with `GET /api/v1/payments`. |
| `A payment for order <orderId> is already being processed.` | Another session for this `orderId` is `processing` and you asked for a different amount. | Wait for the session to become `paid`, or for the indexer to release it back to `open`, then retry. |

The code also has a `409` for an inactive merchant (`Merchant account is not active yet. ...`), but through the API an inactive merchant's key is rejected with `401 authentication` first.

See [Checkout sessions](./checkout-sessions.md#idempotent-re-creation) for how re-creating a session for the same order works.

## server_error

Returned with `500`. Message: `Internal server error.` The details go to the server log, not to the response.

Typical causes on a self-hosted instance: the database is unreachable, or the RPC call that reads the USDT `decimals()` failed while creating a session (the value is read once per server process and then cached). Retry with backoff.

## Errors in the SDK

`createCheckoutSession` from `@whitechain-commerce/react/server` throws `WhitechainApiError` (also exported from `@whitechain-commerce/react`). The `<WhitechainCheckout />` widget uses the same class for failed API calls it reports to `onError`.

| Property | Type | Description |
| --- | --- | --- |
| `message` | string | The API's `error.message`, or a description of the network or local problem. |
| `status` | number | HTTP status, or `0` when the request never reached the API or was rejected locally. |
| `type` | string | The API's `error.type`, `network_error` when the API could not be reached, or `server_error` when a failed response had no error envelope. |

`createCheckoutSession` also validates its inputs before sending anything and throws with `status` `0`. The full list of local checks and API errors is in [Checkout widget: errors](./checkout-widget.md#errors).

```ts
import { createCheckoutSession, WhitechainApiError } from "@whitechain-commerce/react/server";

try {
  const session = await createCheckoutSession({
    apiBase: "https://100lana.com",
    secretKey: process.env.WC_SECRET_KEY!,
    orderId: "order_1042",
    amount: "49.99",
  });
  console.log(session.url);
} catch (e) {
  if (e instanceof WhitechainApiError && e.type === "conflict") {
    // already paid, or a different amount is being processed for this order
  }
  throw e;
}
```

## Operator endpoint errors

`GET /api/cron/tick` is outside `/api/v1` and uses its own errors: `401` with type `authentication_error` for a wrong secret, and `503` with type `server_error` when `CRON_SECRET` is not configured in production. See [API reference](./api-reference.md#operator-endpoint-cron-tick).

## Onchain errors

Some failures happen in the customer's or merchant's wallet, not in the API. The PaymentRouter reverts with these custom errors:

| Error | When |
| --- | --- |
| `MerchantNotRegistered(merchantId)` | `pay()` for a merchant with no payout wallet registered onchain. |
| `ZeroAmount()` | `pay()` or `refund()` with amount 0. |
| `AlreadyPaid(paymentId)` | `pay()` for an onchain order (session) that was already paid. |
| `PaymentNotFound(paymentId)` | `refund()` for a payment id the router never settled. |
| `NotPayout(caller, payout)` | `refund()` sent from a wallet other than the merchant's current payout wallet. |
| `RefundExceedsPayment(requested, refundable)` | `refund()` for more than the amount paid minus what was already refunded. |

USDT transfers also fail if the sender has not approved the router for the amount or does not hold enough USDT.
