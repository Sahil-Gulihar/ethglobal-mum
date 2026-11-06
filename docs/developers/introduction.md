---
title: "Introduction"
description: "The concepts behind Whitechain Commerce: what it does, how money moves, and the objects you work with."
---

Whitechain Commerce lets a merchant accept USDT without ever handing custody of funds to a third party. Customers pay from their own wallet through a small onchain contract, the `PaymentRouter`, which moves the USDT directly to the merchant's payout wallet in the same transaction. The platform watches the chain, confirms each payment against the order it belongs to, and tells your server with a signed webhook.

## Core products

| Product | What it is | Read more |
| --- | --- | --- |
| Checkout widget | `<WhitechainCheckout />`, a React component that connects the customer's wallet, prompts a network switch when needed, checks the USDT balance, asks for an `approve` if needed, sends `pay`, and waits for the backend to confirm the payment. | [Checkout widget](./checkout-widget.md) |
| Payment links | Reusable links for a fixed USDT amount, created in the dashboard without code. | [Payment links](./payment-links.md) |
| Hosted checkout | A full-page checkout at `/checkout/{sessionId}` on the dashboard. Create a session and send the customer to its `url`. No frontend code needed. | [Hosted checkout](./hosted-checkout.md) |
| Checkout sessions | One session prices one order. Your server creates it with a secret key, so the amount can't be changed in the browser. | [Checkout sessions](./checkout-sessions.md) |
| Refunds | Full or partial refunds back to the wallet that paid. You sign them from your payout wallet in the dashboard. | [Refunds](./refunds.md) |
| Webhooks | HMAC-SHA256 signed `payment.succeeded` and `refund.succeeded` events, retried on failure. | [Webhooks](./webhooks.md) |
| Merchant dashboard | Sign up, onboarding checklist, payout wallet, API keys, webhook endpoints with a delivery log, payments and refunds. | [Dashboard](./dashboard.md) |
| CSV export | A download of your payments and succeeded refunds, one row per ledger entry, for your accountant. | [Dashboard](./dashboard.md) |

The server-side SDK is intentionally small: `createCheckoutSession` and `verifyWebhook`, both exported from `@whitechain-commerce/react/server`. Everything else is a plain HTTP call to the [API](./api-reference.md).

## How money flows

The `PaymentRouter` never holds a token balance. Each transfer goes wallet to wallet.

```
Payment
  customer wallet ── approve(router, amount) ──▶ USDT
  customer wallet ── pay(merchantId, orderId, amount) ──▶ PaymentRouter
                                     PaymentRouter ── transferFrom(customer → payout) ──▶ merchant payout wallet
                                     emits PaymentSettled

Refund
  merchant payout wallet ── approve(router, amount) ──▶ USDT
  merchant payout wallet ── refund(paymentId, amount) ──▶ PaymentRouter
                                     PaymentRouter ── transferFrom(payout → original payer) ──▶ customer wallet
                                     emits Refunded
```

1. **Registration.** When you set a payout wallet in the dashboard, the platform's backend signer (the router owner) calls `registerMerchant(merchantId, payout)` onchain. You don't pay gas for this. Only the owner can register or change a payout.
2. **Payment.** If the router's USDT allowance is too low, the customer approves it for the exact amount. Then the customer calls `pay`. The router pulls the USDT from the customer and sends it to whatever payout wallet is registered for the merchant at that moment. Each `(merchantId, orderId)` pair can be paid only once.
3. **Confirmation.** The platform's indexer reads the `PaymentSettled` event and checks it against the checkout session: router address, chain, token, merchant, order, payment id, amount, decimals and receipt status, with one block confirmation. Only the indexer marks a session `paid`. The transaction hash the widget reports is just a hint that speeds this up.
4. **Notification.** The indexer records the payment and queues a `payment.succeeded` webhook to every enabled endpoint.
5. **Refund.** Only the merchant's current payout wallet can call `refund`. The router pulls the USDT from the payout wallet and sends it to the original payer. The total refunded can never exceed the amount paid. The indexer then queues `refund.succeeded`.

Because the platform has no access to your funds, the API can create a refund request but can't execute it. See [Refunds](./refunds.md).

## Object model

All ids are a prefix plus 20 random alphanumeric characters, for example `cs_` followed by 20 characters.

| Object | Id prefix | What it is |
| --- | --- | --- |
| Merchant | `mer_` | Your account. Has a business name, a status and a payout wallet. |
| API key | `key_` | A secret key record. The secret itself is `sk_test_` plus 32 characters, shown once when you create it. Only its SHA-256 hash is stored; the dashboard shows the first 12 characters. |
| Checkout session | `cs_` | One payable order: amount, currency, expiry, redirect URLs, metadata. Expires 30 minutes after creation. |
| Payment | `pay_` | A confirmed onchain payment for a session. At most one per session. |
| Refund | `re_` | A full or partial refund of a payment. |
| Webhook endpoint | `we_` | A URL that receives events. Each has its own signing secret, `whsec_` plus 32 characters. Up to 10 per merchant. |
| Webhook event | `evt_` | One `payment.succeeded` or `refund.succeeded` event. The `id` field of every webhook body. |
| Webhook delivery | `whd_` | One event sent to one endpoint, with its retry state. |
| Delivery attempt | `wha_` | One HTTP attempt of a delivery, shown in the dashboard log. |

Synthetic events from the dashboard's **Send test event** button use a payment id that starts with `pay_test_` and the order id `test_order`.

### Onchain ids

The contract identifies merchants and orders by `bytes32` values derived from the ids above:

| Onchain value | Derived as |
| --- | --- |
| `merchantId` (`chainMerchantId` in the API) | `keccak256(utf8(merchant.id))`, for example of `"mer_..."` |
| `orderId` (`chainOrderId` in the API) | `keccak256(utf8(checkoutSession.id))`, for example of `"cs_..."` |
| `paymentId` (`chainPaymentId` in the API) | `keccak256(abi.encode(merchantId, orderId))`, the same as `PaymentRouter.paymentIdOf` |

The onchain `orderId` comes from the session id, not from your own `orderId`. Your own order id is stored on the session and returned in every payment and refund object.

## Statuses

### Merchant

| Status | Meaning |
| --- | --- |
| `pending` | Signed up but not yet active. API keys don't authenticate and checkout sessions can't be created. |
| `active` | Can register a payout wallet, create API keys and create checkout sessions. |

The dashboard shows whether your merchant account is active. Only active accounts can create checkout sessions.

### Checkout session

| Status | Meaning |
| --- | --- |
| `open` | Waiting for payment. |
| `processing` | The widget reported a transaction hash and the platform is validating it. |
| `paid` | The indexer confirmed a matching payment. Final. |
| `expired` | The session is no longer payable. |

Transitions:

- `open` to `processing`: the widget posts its transaction hash to `/submit`.
- `open` or `processing` to `paid`: the indexer confirms a matching `PaymentSettled` event.
- `processing` to `open`: the reported transaction turned out not to pay this session (reverted, invalid, or unknown), so the customer can retry. If the session's expiry plus a 10 minute grace period has passed, it goes to `expired` instead.
- `open` to `expired`: the 30 minute expiry passed. This is applied lazily when the session is read. A `processing` session is never expired this way.
- `open` or `processing` to `expired`: someone paid this session's onchain order id with the wrong amount (only possible by calling the contract directly). The order id is used up onchain, so the next create call for your order returns a fresh session.
- `expired` to `paid`: a correct payment that lands after expiry is still recorded, because the funds have already moved.

### Payment

| Status | Meaning |
| --- | --- |
| `succeeded` | Paid, nothing refunded. |
| `partially_refunded` | Some, but not all, of the amount has been refunded. |
| `refunded` | The full amount has been refunded. |

A payment only moves forward: `succeeded` to `partially_refunded` to `refunded`, or straight to `refunded`.

### Refund

| Status | Meaning |
| --- | --- |
| `pending` | Requested through the API or dashboard, waiting for the payout wallet to sign `refund`. |
| `succeeded` | The `Refunded` event was confirmed onchain. |

A pending request can be discarded in the dashboard. See [Refunds](./refunds.md#discarding-a-pending-refund). A refund sent directly to the contract without a request is recorded as `succeeded` when the indexer sees it.

### Webhook delivery

| Status | Meaning |
| --- | --- |
| `pending` | Waiting for its first attempt or a retry. |
| `succeeded` | Your endpoint answered with a 2xx status. |
| `failed` | Four attempts failed, or the endpoint is disabled or blocked. Test events are not retried. |

Retries happen 1 minute, 5 minutes and 30 minutes after a failed attempt. See [Webhooks](./webhooks.md#respond-and-retry).

## Network

| | |
| --- | --- |
| Chain id | `1874` (`0x752`) |
| Native gas token | WBT (WhiteBIT Coin), 18 decimals |
| USDT | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7), 6 decimals |
| PaymentRouter | [`0xa99a6D97607567f4fe734831910D24f4e9BD0508`](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508), deploy block `12373441` |
| Public RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | https://explorer.testnet.whitechain.io |
| Faucet (WBT) | https://faucet.testnet.whitechain.io |

Don't use `https://rpc-testnet.whitechain.io` (with a hyphen). It returns chain id 2625, a different network.

Amounts in the API are decimal strings such as `"49.99"`, with at most 6 decimals. Base-unit amounts, such as `amountUnits`, are integers encoded as strings, for example `"49990000"`.

## Limitations

- **USDT only.** `currency` must be `"USDT"`.
- **Refunds need your signature.** `POST /api/v1/refunds` only creates a `pending` request. You sign the refund from your payout wallet in the dashboard, and the payout wallet needs enough USDT and some WBT for gas.
- **One payment per session.** A session's onchain order id can be paid once.
- **Payout changes are rate limited.** Once per 5 minutes per merchant, and new changes are refused while 60 or more merchants have changed their payout in the past hour, because each change is an onchain transaction paid by the backend signer. Payments made to a previous payout wallet are still recorded. Only the current payout wallet can refund.
- **Small server SDK.** `createCheckoutSession` and `verifyWebhook` are the only server helpers. Use HTTP for payments and refunds.
- **Not published to npm.** The SDK packages live in this monorepo as workspace packages. See the [widget installation guide](./checkout-widget.md#installation).

Coming soon, not available today: World ID Proof of Human at onboarding and subscriptions.

Next: [Quickstart](./quickstart.md).
