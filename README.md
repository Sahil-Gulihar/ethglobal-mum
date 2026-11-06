<img src="assets/icon.svg" width="64" height="64" alt="">

# Whitechain Commerce

Whitechain Commerce lets merchants add on-chain USDT payments to their stores. Customers pay from their wallets and funds settle directly to the merchant's payout wallet. Start with hosted checkout or share a fixed-price payment link. Built for ETHGlobal Mumbai 2026.

## Merchant docs

- [Merchant dashboard](https://100lana.com) and [merchant docs](https://100lana.com/docs)
- [Store integration quickstart](docs/developers/quickstart.md), [payment links](docs/developers/payment-links.md), and [webhooks](docs/developers/webhooks.md)
- [Agents and MCP](docs/developers/agents.md)

For contributors and operators: [self-hosting](docs/SELF_HOSTING.md), [maintainer testing](docs/MAINTAINER_TESTING.md), [product spec](docs/SPEC.md), and [deployments](docs/DEPLOYMENTS.md).

## WooCommerce plugin

[Download the WooCommerce plugin ZIP](https://github.com/Sahil-Gulihar/ethglobal-mum/releases/download/woocommerce-v0.1.0/whitechain-commerce-woocommerce.zip). This testnet prerelease supports Classic Checkout and Checkout Blocks on USD stores. It charges 1 testnet USDT per USD.

1. In WordPress, go to **Plugins → Add New → Upload Plugin**, upload the ZIP, and activate **Whitechain Commerce**. Make sure WooCommerce is active and your store currency is USD.
2. In the [Whitechain dashboard](https://100lana.com), register a testnet payout wallet and create a test API key.
3. In **WooCommerce → Settings → Payments → Whitechain Commerce**, enter the API key and copy the webhook URL shown in the settings.
4. Add that URL as a webhook endpoint in the Whitechain dashboard. Paste its signing secret into the WooCommerce settings, enable the gateway, and save.

The v0.1.0 ZIP defaults to the original Vercel hostname. To use the current Whitechain domain with this ZIP, add `define('WHITECHAIN_API_ORIGIN', 'https://100lana.com');` to `wp-config.php` before the line that loads WordPress.

[Full WooCommerce setup guide](integrations/woocommerce/README.md)

## Why Whitechain

Customers pay in USDT on Whitechain and the funds go directly to the merchant's wallet. Each confirmed payment and refund has a transaction record you can verify on the block explorer.

## Deployed contract

| | |
|---|---|
| Chain ID | `1874` |
| PaymentRouter | [`0xa99a6D97607567f4fe734831910D24f4e9BD0508`](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) (deploy block `12373441`) |
| Source verification | Verified on the [Whitechain explorer](https://explorer.testnet.whitechain.io/address/0xa99a6D97607567f4fe734831910D24f4e9BD0508) and [Sourcify](https://sourcify.dev/server/v2/contract/1874/0xa99a6D97607567f4fe734831910D24f4e9BD0508) (exact match) |
| USDT (official, 6 decimals) | [`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`](https://explorer.testnet.whitechain.io/token/0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7) |
| Public RPC | `https://rpc.testnet.whitechain.io` |
| Faucet | https://faucet.testnet.whitechain.io |

## Payment and refund explorer links

The first end-to-end demo covered dashboard signup, backend-signed registration, a store order, indexing and signed webhooks. Order `order_c3956bc0f34ad6f6`
(Tasting Sachet 0.99 + Masala Chai Tin 4.99 = 5.98 USDT), partially refunded 2.00 USDT. All statuses are `success`.

| Step | What | Transaction |
|---|---|---|
| 0 | Customer gets testnet USDT by swapping WBT in the YetiTrade testnet pool | [`0x1c12f7c1…b5ddd6`](https://explorer.testnet.whitechain.io/tx/0x1c12f7c1b1d372147975f03f11d10b1a1be46bc5ed2177ac7055c121b3b5ddd6) |
| 1 | Merchant registered: backend signer calls `registerMerchant` for Chai & Co.'s payout wallet | [`0x977e275c…6efaa9`](https://explorer.testnet.whitechain.io/tx/0x977e275c71308a9a3c13003f4922d28704beb8c2caefb6cf73ff77b7cf6efaa9) |
| 2 | Customer approves the PaymentRouter for 5.98 USDT | [`0xe1021fee…69a5d6`](https://explorer.testnet.whitechain.io/tx/0xe1021feec583a277d39b0cd13c03d7e4768ee8d552fae216e3a0e691e969a5d6) |
| 3 | Customer payment: `pay(merchantId, orderId, 5.98 USDT)` to the merchant's wallet | [`0xebd1c99a…e05125`](https://explorer.testnet.whitechain.io/tx/0xebd1c99ae548a3e497084f92a3d41d1bb0a8a5f4b775a681ebccd715e3e05125) |
| 4 | Merchant payout wallet approves the PaymentRouter for the 2.00 USDT refund | [`0x96c1ab28…e3f559`](https://explorer.testnet.whitechain.io/tx/0x96c1ab28b6ea31f576f5a833d5e0b785f6fcd250a3962f8252c1ac1f67e3f559) |
| 5 | Partial refund: `refund(paymentId, 2.00 USDT)` back to the customer | [`0xe2fcbd3d…1bab52`](https://explorer.testnet.whitechain.io/tx/0xe2fcbd3d4a23bbb35964def3f7509bd2883a167164b790733ff069ef5c1bab52) |

The indexer marked the session `paid` and the refund `succeeded`; the store received `payment.succeeded` and
`refund.succeeded` with verified signatures, and the order ended as `partially_refunded`.

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
pnpm dev                      # dashboard, demo store, and background worker
```

Both apps and the worker load the **root** `.env`. The worker scans the chain and delivers webhooks every 4 seconds.
For deployment, run `pnpm worker` as a separate, supervised long-running process with the same database, RPC, and
router configuration as the dashboard. Restart it on failure and monitor it: without it, the chain scan and webhook
delivery stop. Environment variables supplied by the host work without a `.env` file. Webhooks are delivered at least
once, so consumers must deduplicate events by ID.

For Coolify, create a Git-backed Docker Compose application with `/compose.worker.yml`.
Set `DATABASE_URL` to the dashboard database and `WHITECHAIN_RPC_URL` to its chain RPC.
If the dashboard overrides the router address, set the same `PAYMENT_ROUTER_ADDRESS`.
Run one replica without a public domain. The worker reads the chain and sends webhooks
without the router owner's private key. GitHub Actions builds the image and runs a
checkpoint and webhook retry smoke test against an isolated database.

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
pnpm test:csv                                            # accountant CSV export (builder + merchant-scoped query)
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
   `wc_fork` `DATABASE_URL`, then run `pnpm dev`. Shell variables take precedence over `.env`.
4. Fund a test customer:
   1. Find a USDT holder with `cast logs` on the USDT `Transfer` event.
   2. Run `cast rpc anvil_impersonateAccount <holder>`.
   3. Run `cast send <USDT> 'transfer(address,uint256)' <customer> 50000000 --from <holder> --unlocked`.
5. Pay a session with `approve(router, amountUnits)` and `pay(chainMerchantId, chainOrderId, amountUnits)`. The values
   come from `GET /api/v1/checkout_sessions/:id`. You can also use the widget with a browser wallet pointed at the fork.

## Limitations

- **World ID uses the staging environment by default.** New merchants verify with World ID Proof of Human on the
  Setup page (test with the simulator at https://simulator.worldcoin.org). One World ID can back only one merchant
  account. Set `WORLD_ENVIRONMENT=production` for real World App users, or `SKIP_WORLD_ID=true` to activate on signup.
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
