# Maintainer testing

## Run the test suites

Run these from the repository root unless a step says otherwise. Scripts that touch the database or the chain read the root `.env`. See [Self-hosting](./SELF_HOSTING.md) for setup.

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

- [Webhooks](./developers/webhooks.md)
- [Dashboard](./developers/dashboard.md)
- [Self-hosting](./SELF_HOSTING.md)
