---
title: "Testing"
description: "How to get testnet funds, test your webhook handler, and run the project's test suites."
---

Whitechain Commerce runs on Whitechain Sepolia (chain id `1874`) only. There is no live mode: every secret key is `sk_test_`, and every payment uses testnet USDT with no real value.

## Network details

| | |
| --- | --- |
| Network | Whitechain Sepolia, chain id `1874` (`0x752`) |
| Gas token | WBT (18 decimals) |
| Public RPC | `https://rpc.testnet.whitechain.io` |
| Explorer | https://explorer.testnet.whitechain.io |
| Faucet | https://faucet.testnet.whitechain.io |
| USDT | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7), 6 decimals |
| PaymentRouter | [`0xa99a6D97607567f4fe734831910D24f4e9BD0508`](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) |

Use `rpc.testnet.whitechain.io` with a dot. `rpc-testnet.whitechain.io` with a hyphen returns chain id 2625, which is a different network.

## Get testnet funds

A test customer needs USDT to pay and WBT for gas. A merchant payout wallet needs WBT for gas to approve and send refunds, and USDT to refund with.

### WBT

Claim WBT from the faucet at https://faucet.testnet.whitechain.io. The faucet sets its own eligibility rules and claim limits, which this project doesn't control or document. The checkout widget links to the same faucet when a customer's wallet is short of WBT or USDT.

### USDT

The wallet for our first live run got its testnet USDT by swapping WBT for USDT in the YetiTrade testnet pool: [swap transaction](https://explorer.testnet.whitechain.io/tx/0x1c12f7c1b1d372147975f03f11d10b1a1be46bc5ed2177ac7055c121b3b5ddd6).

Make sure you receive the official USDT at `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`. The router only accepts that token, and the indexer ignores payments in any other token.

To see USDT in your wallet, add it as a custom token with that address, symbol `USDT` and 6 decimals.

## Test the payment flow

1. In the dashboard, register a payout wallet, create a secret key and add a webhook endpoint. See the [quickstart](./quickstart.md).
2. Create a checkout session from your server, or with `curl`:

   ```bash
   curl -X POST http://localhost:3000/api/v1/checkout_sessions \
     -H "Authorization: Bearer $WC_SECRET_KEY" -H "Content-Type: application/json" \
     -d '{"orderId":"order_123","amount":"4.99","successUrl":"http://localhost:3001/"}'
   ```

3. Open the session's `url` (the [hosted checkout](./hosted-checkout.md)) or render the [checkout widget](./checkout-widget.md), and pay with a wallet that holds testnet USDT and WBT.
4. Watch the payment appear in **Payments** and the `payment.succeeded` delivery in **Webhooks**.
5. Refund part of it from the payment page. See [Dashboard: refunds](./dashboard.md#refunds).

Keep `pnpm worker` running (or call the cron tick). The widget's `/submit` call can confirm a payment on its own, but webhooks are only sent by the worker or the cron tick. See [Self-hosting](./self-hosting.md#run-the-worker).

## Test webhooks locally

### Send a test event from the dashboard

On **Webhooks**, choose **Send test event** on an enabled endpoint. You get one signed `payment.succeeded` event with placeholder data: a payment id starting with `pay_test_`, order id `test_order` and amount `1.00`. The dashboard shows the HTTP status and response time right away. Test events are never retried.

Your handler should ignore events for orders it doesn't know, so the test event is safe to receive.

### Use a local URL

Outside production, the dashboard accepts webhook URLs on `localhost` and private addresses, so you can point an endpoint at your local server, for example `http://localhost:3001/api/webhooks/whitechain` for the demo store. A dashboard running in production rejects them unless `ALLOW_PRIVATE_WEBHOOK_URLS=true` is set. To receive events from a deployed dashboard on your machine, use a tunnel such as ngrok or cloudflared and register its public `https://` URL.

### Sign a request by hand

The `WC-Signature` header is `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, keyed with the endpoint's `whsec_` secret. `verifyWebhook` rejects a timestamp more than 300 seconds away from the current time, in either direction. This script sends a correctly signed request to a local handler:

```bash
SECRET=whsec_...   # Webhooks > Reveal
BODY='{"id":"evt_local_1","type":"payment.succeeded","created":1700000000,"data":{"payment":{"id":"pay_local_1","orderId":"order_123","amount":"4.99"}}}'
T=$(date +%s)
SIG=$(printf '%s' "$T.$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -i -X POST http://localhost:3001/api/webhooks/whitechain \
  -H 'Content-Type: application/json' \
  -H "WC-Signature: t=$T,v1=$SIG" \
  -d "$BODY"
```

The payload above is shortened. Real events carry the full payment object. See [Webhooks](./webhooks.md) for the complete format.

To check that your handler rejects bad signatures, send a wrong one:

```bash
curl -i -X POST http://localhost:3001/api/webhooks/whitechain \
  -H 'Content-Type: application/json' -H 'WC-Signature: t=1,v1=00' -d '{}'
```

The demo store answers `400` and logs the rejection on its `/admin` page.

### Test retries and redelivery

Return a non-`2xx` status from your handler and the delivery shows as **Retrying** in the dashboard. It's retried 1 minute after the first failed attempt, 5 minutes after the second and 30 minutes after the third. A fourth failure marks it **Failed**. Retries are sent only while the worker or the cron tick is running. Fix the handler and choose **Redeliver** to send it again right away.

## Run the test suites

Run these from the repository root unless a step says otherwise. Scripts that touch the database or the chain read the root `.env`. See [Self-hosting](./self-hosting.md) for setup.

### Typecheck and build

```bash
pnpm typecheck                                     # runs typecheck in every package
pnpm --filter dashboard build && pnpm --filter demo-store build
```

### Smart contract tests

The contract tests need [Foundry](https://getfoundry.sh). Fetch the pinned Solidity dependencies once, then run the tests:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
bash contracts/install-deps.sh
pnpm test:contracts                                # same as: cd contracts && forge test
```

This runs the unit and fuzz tests for `PaymentRouter`. The fork test against the real USDT on chain 1874 is skipped unless `WHITECHAIN_RPC_URL` is set. To include it:

```bash
cd contracts && set -a && . ../.env && set +a && forge test -vv
```

### SDK tests

```bash
pnpm --filter @whitechain-commerce/react test
```

These cover the checkout widget's state machine and the server helpers (`createCheckoutSession`, `verifyWebhook`). They need no database or network.

### Dashboard scripts

Run these from `apps/dashboard`. They need a running Postgres with the schema pushed (`pnpm db:push`), and they insert throwaway rows that they clean up afterwards. Each one loads the root `.env` with `--env-file`, so that file must exist.

```bash
cd apps/dashboard
pnpm smoke:api
pnpm test:csv
pnpm exec tsx --env-file=../../.env scripts/test-webhooks.ts
```

| Command | What it tests |
| --- | --- |
| `pnpm smoke:api` | The `/api/v1` route handlers, called directly without a dev server. It creates two merchants and keys, then checks sessions, submit, payments and refunds, including auth and validation errors. Creating a session reads the USDT decimals onchain, so it also needs a reachable `WHITECHAIN_RPC_URL`. |
| `pnpm test:csv` | The CSV export builder (columns, escaping, formula protection, date ranges) and the merchant-scoped ledger query. The database part is skipped if `DATABASE_URL` is unset. |
| `scripts/test-webhooks.ts` | Webhook delivery against a local HTTP receiver: signatures, the user agent, retries, redelivery and test events. It has no package script, so run it with `tsx` as shown. |

### Indexer end to end test on an anvil fork

This test needs Foundry (`forge` and `anvil` on your `PATH`), Postgres, and `WHITECHAIN_RPC_URL` in the root `.env`. It starts its own anvil fork of Whitechain Sepolia on port 8546, deploys a mock router that emits the same events, and checks every settlement rule, idempotency under concurrency and refund matching. It uses its own indexer cursor and cleans up its rows.

```bash
cd apps/dashboard
PATH=$HOME/.foundry/bin:$PATH pnpm exec tsx --env-file=../../.env src/lib/indexer/e2e-test.ts
```

## Full run on a local fork

You can run the whole product against an anvil fork, with no real testnet funds. The real router and USDT exist on the fork.

1. Start the fork:

   ```bash
   anvil --fork-url $WHITECHAIN_RPC_URL --chain-id 1874 --port 8545 --block-time 2
   ```

2. Create a scratch database and push the schema. With the repo's Docker Compose setup:

   ```bash
   docker compose exec db psql -U wc -d whitechain_commerce -c 'create database wc_fork'
   DATABASE_URL=postgres://wc:wc@localhost:5433/wc_fork pnpm db:push
   ```

3. In the shell where you start the apps, export `WHITECHAIN_RPC_URL=http://127.0.0.1:8545`, `NEXT_PUBLIC_WHITECHAIN_RPC_URL=http://127.0.0.1:8545` and the `wc_fork` `DATABASE_URL`. Then run `pnpm dev` and `pnpm worker`. Shell variables take precedence over `.env`.
4. Fund a test customer on the fork:
   1. Find a USDT holder with `cast logs` on the USDT `Transfer` event.
   2. Run `cast rpc anvil_impersonateAccount <holder>`.
   3. Run `cast send 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 'transfer(address,uint256)' <customer> 50000000 --from <holder> --unlocked` (50 USDT).
5. Pay a session. Either use the widget with a browser wallet pointed at `http://127.0.0.1:8545`, or call `approve(router, amountUnits)` on USDT and `pay(chainMerchantId, chainOrderId, amountUnits)` on the router. The values come from `GET /api/v1/checkout_sessions/:id`.

The dashboard's payout registration also runs on the fork, so the backend signer needs WBT there. Anvil forks keep the real balances, so a funded testnet signer works.

## Live run on Whitechain Sepolia

These are real testnet transactions from our first live run of the demo flow: dashboard signup, backend-signed registration, a demo store order, the indexer and signed webhooks. Order `order_c3956bc0f34ad6f6` (5.98 USDT) was partially refunded by 2.00 USDT.

| Step | What | Transaction |
| --- | --- | --- |
| 0 | Customer swaps WBT for USDT in the YetiTrade testnet pool | [`0x1c12f7c1…b5ddd6`](https://explorer.testnet.whitechain.io/tx/0x1c12f7c1b1d372147975f03f11d10b1a1be46bc5ed2177ac7055c121b3b5ddd6) |
| 1 | Backend signer calls `registerMerchant` for the merchant's payout wallet | [`0x977e275c…6efaa9`](https://explorer.testnet.whitechain.io/tx/0x977e275c71308a9a3c13003f4922d28704beb8c2caefb6cf73ff77b7cf6efaa9) |
| 2 | Customer approves the PaymentRouter for 5.98 USDT | [`0xe1021fee…69a5d6`](https://explorer.testnet.whitechain.io/tx/0xe1021feec583a277d39b0cd13c03d7e4768ee8d552fae216e3a0e691e969a5d6) |
| 3 | Customer pays: `pay(merchantId, orderId, 5.98 USDT)` | [`0xebd1c99a…e05125`](https://explorer.testnet.whitechain.io/tx/0xebd1c99ae548a3e497084f92a3d41d1bb0a8a5f4b775a681ebccd715e3e05125) |
| 4 | Payout wallet approves the PaymentRouter for the 2.00 USDT refund | [`0x96c1ab28…e3f559`](https://explorer.testnet.whitechain.io/tx/0x96c1ab28b6ea31f576f5a833d5e0b785f6fcd250a3962f8252c1ac1f67e3f559) |
| 5 | Partial refund: `refund(paymentId, 2.00 USDT)` back to the customer | [`0xe2fcbd3d…1bab52`](https://explorer.testnet.whitechain.io/tx/0xe2fcbd3d4a23bbb35964def3f7509bd2883a167164b790733ff069ef5c1bab52) |

The indexer marked the session `paid` and the refund `succeeded`. The store received `payment.succeeded` and `refund.succeeded` with verified signatures, and the order ended as `partially_refunded`.

## Related

- [Webhooks](./webhooks.md)
- [Dashboard](./dashboard.md)
- [Self-hosting](./self-hosting.md)
