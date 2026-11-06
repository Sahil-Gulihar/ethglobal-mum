<img src="assets/icon.svg" width="64" height="64" alt="">

# Whitechain Commerce

A drop-in, non-custodial USDT checkout for Whitechain. A merchant signs up, registers a payout wallet, and adds a
React component (or links to a hosted checkout page). Customers pay in USDT straight from their wallet to the merchant's
wallet in one block. The merchant gets signed webhooks and a dashboard, and can send full or partial refunds that are
linked to the original payment onchain. Built for ETHGlobal Mumbai 2026.

- [Product spec](docs/SPEC.md) · [Frozen interfaces](docs/INTERFACES.md) · [Deployments](docs/DEPLOYMENTS.md)

## Why Whitechain

Card rails can't give a merchant final settlement in seconds to a wallet they control, with no chargebacks, payout delays or cross-border fees. Whitechain USDT settlement does, and every payment and refund is linked to its order onchain so customers can verify it themselves.

## Deployed contract

| | |
|---|---|
| Network | Whitechain Sepolia, chain id `1874` |
| PaymentRouter | [`0xa99a6D97607567f4fe734831910D24f4e9BD0508`](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) (deploy block `12373441`) |
| Source verification | [Sourcify exact match](https://sourcify.dev/server/v2/contract/1874/0xa99a6D97607567f4fe734831910D24f4e9BD0508). Blockscout verification was down at deploy time; see [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md) for the retry command |
| USDT (official, 6 decimals) | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) |
| Public RPC | `https://rpc.testnet.whitechain.io` |
| Faucet | https://faucet.testnet.whitechain.io |

## Payment and refund explorer links

Real testnet transactions from the demo flow (official USDT):

| What | Transaction |
|---|---|
| Merchant registered (payout wallet) | TODO: `https://explorer.testnet.whitechain.io/tx/0x...` |
| Customer payment (Chai & Co. order) | TODO: `https://explorer.testnet.whitechain.io/tx/0x...` |
| Partial refund | TODO: `https://explorer.testnet.whitechain.io/tx/0x...` |

## Architecture

```
 customer wallet ──approve + pay(merchantId, orderId, amount)──▶ PaymentRouter ──transferFrom──▶ merchant payout wallet
        ▲                                                              │ PaymentSettled / Refunded events
        │ <WhitechainCheckout/> (React SDK, viem, EIP-6963)            ▼
 ┌──────┴────────────┐   POST /api/v1/checkout_sessions   ┌───────────────────────────────────────────────┐
 │ merchant store    │ ─────────────────────────────────▶ │ apps/dashboard (Next.js, :3000)               │
 │ (apps/demo-store, │   (sk_test_ secret key)            │  /api/v1/*  merchant API + public session API │
 │  :3001)           │ ◀───── signed webhooks ──────────── │  /checkout/:id  hosted checkout page          │
 └───────────────────┘   payment.succeeded,               │  /dashboard  merchant dashboard               │
                         refund.succeeded                  │  worker: indexer + webhook delivery (Postgres)│
                                                           └───────────────────────────────────────────────┘
```

- **`contracts/`**: `PaymentRouter.sol` (Foundry). Non-custodial: `pay` moves USDT from the payer directly to the
  merchant's registered payout address, and `refund` moves it from the payout back to the payer. The router never holds
  a balance. Only the owner (backend signer) can register merchant payouts. Each `(merchantId, orderId)` can be paid once.
- **`packages/core`**: chain config, ABI, deterministic ids (`merchantId = keccak(merchant.id)`,
  `orderId = keccak(session.id)`), money helpers, shared types, webhook signing and verification.
- **`packages/react`** (`@whitechain-commerce/react`): the `<WhitechainCheckout sessionId />` widget (connect, switch
  to chain 1874, check the balance, approve, pay, submit, wait for backend confirmation) and server helpers
  (`createCheckoutSession`, `verifyWebhook`) under `@whitechain-commerce/react/server`.
- **`apps/dashboard`**: merchant signup and login, onboarding checklist, payments and refunds, API keys, webhook
  endpoints with a delivery log and redelivery, settings, the `/api/v1` API, and the hosted checkout page.
  - The **indexer** (`src/lib/indexer`) is the only thing that marks a session paid. It checks each `PaymentSettled`
    log against the session: router address, chain, merchant, order, paymentId, amount, token, decimals and receipt
    status, with one confirmation. The browser's tx hash
    is only a hint that speeds this up.
  - **Webhooks** (`src/lib/webhooks`) are HMAC-SHA256 signed (`WC-Signature: t=..,v1=..`), delivered at least once,
    and retried after 1 min, 5 min and 30 min.
- **`apps/demo-store`**: "Chai & Co.", a sample merchant that integrates only through the public SDK. It prices orders
  on the server and fulfils them only from verified webhooks.

## Setup

Requirements: Node 20+, pnpm 10, Docker, and [Foundry](https://getfoundry.sh) for the contracts.

```bash
pnpm i
cp .env.example .env          # then fill in WHITECHAIN_RPC_URL, DEPLOYER_PRIVATE_KEY/ADDRESS (router owner), etc.
docker compose up -d db       # Postgres on :5433
pnpm db:push                  # create the schema
pnpm dev                      # dashboard on :3000 and demo store on :3001
pnpm worker                   # in another terminal: indexer + webhook delivery every 4 s
```

Both apps load the **root** `.env`. Without the worker, payments are still confirmed through the `/submit` hint and
`GET /api/cron/tick` (with `Authorization: Bearer $CRON_SECRET`), but webhooks are only sent by the worker or the cron tick.

Contracts: `bash contracts/install-deps.sh && cd contracts && forge test`.

## Running the demo

1. Open http://localhost:3000, sign up, and follow the onboarding checklist:
   - Add a payout wallet. The backend signer calls `registerMerchant` onchain.
   - Create a secret key. It is shown once.
   - Add the webhook endpoint `http://localhost:3001/api/webhooks/whitechain`.
2. Put `WC_SECRET_KEY=sk_test_...` and `WC_WEBHOOK_SECRET=whsec_...` (Webhooks → Reveal) in the root `.env`, then
   restart the demo store.
3. Open http://localhost:3001, add something to the cart, and choose "Checkout with USDT". Pay with a wallet that holds
   testnet USDT and some WBT for gas. The order page switches to "Fulfilled via verified webhook ✓", and `/admin`
   shows the signature-verified webhook log.
4. In the dashboard, open the payment and choose **Refund**. Connect the payout wallet, enter a partial amount, approve
   and send. The store receives `refund.succeeded`.

A hosted checkout also works without any store code: create a session with the API and open its `url`
(`http://localhost:3000/checkout/cs_...`).

```bash
curl -X POST http://localhost:3000/api/v1/checkout_sessions \
  -H "Authorization: Bearer sk_test_..." -H "Content-Type: application/json" \
  -d '{"orderId":"order_123","amount":"4.99","successUrl":"http://localhost:3001/"}'
```

## Testing

```bash
pnpm -r typecheck
pnpm --filter dashboard build && pnpm --filter demo-store build
pnpm --filter @whitechain-commerce/react test            # SDK state machine and server helpers
cd contracts && forge test                               # 19 unit and fuzz tests (+ fork test when WHITECHAIN_RPC_URL is set)
cd apps/dashboard
pnpm smoke:api                                           # /api/v1 handlers against local Postgres
pnpm exec tsx --env-file=../../.env scripts/test-webhooks.ts
PATH=$HOME/.foundry/bin:$PATH pnpm exec tsx --env-file=../../.env src/lib/indexer/e2e-test.ts   # indexer on an anvil fork
```

**Full end to end run on a local fork (no real funds).** This has been run successfully: browser checkout, indexing,
webhook delivery to the store, and partial and full refunds from the dashboard.

1. Start the fork: `anvil --fork-url $WHITECHAIN_RPC_URL --chain-id 1874 --port 8545 --block-time 2`. The real router
   and USDT exist on the fork.
2. Create a scratch database: `docker exec ethglobal-mum-db-1 psql -U wc -c 'create database wc_fork'`, then run
   `DATABASE_URL=postgres://wc:wc@localhost:5433/wc_fork pnpm db:push`.
3. Export `WHITECHAIN_RPC_URL=http://127.0.0.1:8545`, `NEXT_PUBLIC_WHITECHAIN_RPC_URL=http://127.0.0.1:8545` and the
   `wc_fork` `DATABASE_URL`, then run `pnpm dev` and `pnpm worker`. Shell variables take precedence over `.env`.
4. Fund a test customer:
   1. Find a USDT holder with `cast logs` on the USDT `Transfer` event.
   2. Run `cast rpc anvil_impersonateAccount <holder>`.
   3. Run `cast send <USDT> 'transfer(address,uint256)' <customer> 50000000 --from <holder> --unlocked`.
5. Pay a session with `approve(router, amountUnits)` and `pay(chainMerchantId, chainOrderId, amountUnits)`. The values
   come from `GET /api/v1/checkout_sessions/:id`. You can also use the widget with a browser wallet pointed at the fork.

## Limitations

- **World ID is deferred.** Merchants become `active` at signup while `SKIP_WORLD_ID=true`. If `SKIP_WORLD_ID` is
  unset, it is skipped only outside production. The status column and the `requireActive` checks are in place so
  Proof of Human can be added at onboarding.
- **Testnet only** (Whitechain Sepolia). All API keys are `sk_test_`.
- **Refunds are signed by the merchant.** The API can create a *pending* refund, but because the platform is
  non-custodial it can't move funds. The merchant signs it from the payout wallet in the dashboard.
- **One payment per session.** A session's onchain `orderId` can be paid once. A payment for the wrong amount (sent by
  calling the contract directly, e.g. a dust front-run) is not recorded, but it uses up that `orderId`, so the indexer
  marks the session `expired` and the next `POST /checkout_sessions` for that order creates a fresh one. The proper fix
  is a backend-signed quote checked by the contract.
- **Payout changes.** The payout in a `PaymentSettled` event is whatever was registered onchain at pay time, so payments
  to an old payout are still accepted. Changing the payout re-registers it onchain (rate-limited: once per 5 minutes per
  merchant, 60 per hour overall), and only the current payout can refund.
- **Webhook URLs.** In production, endpoints must resolve to public IPs (checked on create and on every delivery).
  Set `ALLOW_PRIVATE_WEBHOOK_URLS=true` to allow localhost/private addresses; outside production they are allowed.
- **Demo store admin** (`/admin`) is public: it's a demo.
- The demo store keeps orders in a JSON file (`apps/demo-store/data/orders.json`). It's a demo, not a pattern.
- Blockscout source verification is pending (the explorer's verifier was down). The source is verified on Sourcify.
