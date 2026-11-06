# Whitechain Commerce developer docs

Everything you need to accept USDT on Whitechain with Whitechain Commerce.

Whitechain Commerce is a non-custodial USDT checkout for Whitechain Sepolia (chain id `1874`).
Your server creates a checkout session, the customer pays from their own wallet straight to your payout wallet, and you get a signed webhook when the payment is confirmed onchain.
You can refund in full or in part from the same payout wallet. The platform never holds your funds.

New here? Read the [introduction](./introduction.md), then follow the [quickstart](./quickstart.md).

## Contents

| Page | What it covers |
| --- | --- |
| [Docs home](./README.md) | This page |
| [Introduction](./introduction.md) | Core products, how money flows, the object model, statuses, network details and limitations |
| [Quickstart](./quickstart.md) | Take your first testnet payment end to end in about 10 minutes |
| [Checkout widget](./checkout-widget.md) | The `<WhitechainCheckout />` React component, its props and callbacks |
| [Hosted checkout](./hosted-checkout.md) | Redirect customers to a checkout page hosted by the dashboard |
| [Checkout sessions](./checkout-sessions.md) | Creating sessions from your server, idempotency and expiry |
| [Payments](./payments.md) | The payment object and how payments are confirmed |
| [Refunds](./refunds.md) | Full and partial refunds signed by your payout wallet |
| [Webhooks](./webhooks.md) | Events, signature verification, retries and redelivery |
| [API reference](./api-reference.md) | Every `/api/v1` endpoint with request and response fields |
| [Errors](./errors.md) | Error format, error types and HTTP status codes |
| [Smart contract](./smart-contract.md) | The `PaymentRouter` contract, its functions, events and errors |
| [Dashboard](./dashboard.md) | The merchant dashboard, onboarding checklist and CSV export |
| [Testing](./testing.md) | Testnet funds, test webhook events and local fork testing |
| [Self-hosting](./self-hosting.md) | Running the dashboard, worker and database yourself |
| [llms.txt](./llms.txt) | A plain-text index of these docs for LLMs and coding agents |
