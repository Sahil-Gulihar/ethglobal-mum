---
title: "Self-hosting"
description: "How to run Whitechain Commerce yourself: the architecture, setup, every environment variable, the worker, and contract deployment."
---

## Architecture

```
 customer wallet ──approve + pay(merchantId, orderId, amount)──▶ PaymentRouter ──transferFrom──▶ merchant payout wallet
        ▲                                                              │ PaymentSettled / Refunded events
        │ <WhitechainCheckout /> (React SDK)                           ▼
 ┌──────┴────────────┐   POST /api/v1/checkout_sessions   ┌───────────────────────────────────────────────┐
 │ merchant store    │ ─────────────────────────────────▶ │ apps/dashboard (Next.js, :3000)               │
 │ (apps/demo-store, │   (sk_test_ secret key)            │  /api/v1/*  merchant API + public session API │
 │  :3001)           │ ◀───── signed webhooks ─────────── │  /checkout/:id  hosted checkout page          │
 └───────────────────┘                                    │  /dashboard  merchant dashboard               │
                                                          │  worker: indexer + webhook delivery           │
                                                          └───────────────────────────────────────────────┘
```

| Part | Path | What it does |
| --- | --- | --- |
| Contract | `contracts/` | `PaymentRouter.sol` (Foundry). `pay` moves USDT from the payer straight to the merchant's registered payout wallet, and `refund` moves it from the payout wallet back to the payer. The router never holds a balance. Only the owner (the backend signer) can register payout wallets. |
| Dashboard app | `apps/dashboard` | One Next.js app with the merchant dashboard, the `/api/v1` API, the hosted checkout page at `/checkout/:sessionId`, and the `/api/cron/tick` route. |
| Indexer | `apps/dashboard/src/lib/indexer` | Reads `PaymentSettled` and `Refunded` logs from the router, checks each one against the database, and is the only thing that marks a session paid. Waits for one confirmation. |
| Webhook worker | `apps/dashboard/src/lib/webhooks` | Signs and delivers events, retrying after 1, 5 and 30 minutes. |
| Worker process | `apps/dashboard/scripts/worker.ts` | Runs one indexer pass and then the due webhook deliveries (up to 100) about every 4 seconds. |
| Demo store | `apps/demo-store` | "Chai & Co.", a sample merchant on port 3001 that uses only the public SDK. |
| Core package | `packages/core` | Chain config, ABI, deterministic ids, money helpers, shared types, webhook signing and verification. |
| React SDK | `packages/react` | `@whitechain-commerce/react`: the `<WhitechainCheckout />` widget, plus `createCheckoutSession` and `verifyWebhook` under `@whitechain-commerce/react/server`. |

Postgres stores merchants, keys, sessions, payments, refunds, webhook endpoints, events, deliveries, attempts and the indexer cursor.

## Requirements

- Node.js 20 or later
- pnpm 10 (the repo pins `pnpm@10.28.2`)
- Postgres. The repo's Docker Compose file runs Postgres 16. Any Postgres you can reach with a connection string works, including a hosted one such as Neon.
- [Foundry](https://getfoundry.sh), only for the contract tests and deployment
- An RPC endpoint for Whitechain Sepolia (chain id `1874`). The public `https://rpc.testnet.whitechain.io` needs no key.
- A backend signer wallet that owns the `PaymentRouter` and holds WBT for gas. Use a testnet hot wallet only.

## Set up and run locally

```bash
pnpm install
cp .env.example .env          # then fill in the values, see "Environment variables"
docker compose up -d db       # Postgres on localhost:5433 (or: pnpm db:up)
pnpm db:push                  # create the schema
pnpm dev                      # dashboard on :3000 and demo store on :3001
```

### Run the worker

In a second terminal:

```bash
pnpm worker                   # indexer + webhook delivery every 4 s
```

Without the worker, a payment is still confirmed when the checkout widget posts its transaction hash to `/submit`, but webhooks are only sent by the worker or the cron tick, and payments whose browser never submits are only picked up by the indexer.

### Contracts

```bash
export PATH="$HOME/.foundry/bin:$PATH"
bash contracts/install-deps.sh && cd contracts && forge test
```

`install-deps.sh` fetches pinned dependencies (OpenZeppelin Contracts v5.7.0, forge-std v1.17.0) into `contracts/lib`. They're not git submodules.

### Use a different Postgres

Set `DATABASE_URL` in the root `.env` to your connection string and run `pnpm db:push`. For Neon, use the connection string from the Neon console. It includes `sslmode=require`, which the `postgres` driver reads from the URL.

`pnpm db:push` runs `drizzle-kit push --force`. It applies schema changes without asking, including ones that drop data, so don't point it at a database you care about without checking first.

### How env files are loaded

Both Next.js apps load the **root** `.env` (their `next.config.ts` calls `loadEnvConfig` on the repo root). `pnpm db:push`, `pnpm worker` and the dashboard test scripts load it with Node's `--env-file=../../.env`, so that file must exist. Variables already set in your shell take precedence over the file.

## Environment variables

Never commit `.env`. It's gitignored.

### Dashboard, API and worker

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string. The app, the worker, `pnpm db:push` and the test scripts fail without it. The example value is `postgres://wc:wc@localhost:5433/whitechain_commerce`, which matches `docker-compose.yml`. |
| `WHITECHAIN_RPC_URL` | Yes | Server-side RPC for chain 1874. Used by the indexer, payment validation on `/submit`, checkout session creation (it reads the USDT `decimals()` once per process), payout registration, and refund balance and receipt checks. Also used by the contract fork test and the indexer end to end test. |
| `DEPLOYER_PRIVATE_KEY` | Yes, to register payout wallets | Private key of the backend signer. It must be the `PaymentRouter` owner, because it calls `registerMerchant`. Also used by `forge script` when deploying. |
| `APP_URL` | No. Default `http://localhost:3000` | Public base URL of the dashboard. Used to build each checkout session's hosted `url` (`APP_URL/checkout/cs_...`) and the API base shown on the Developers page. Set it to your public URL in production. |
| `CRON_SECRET` | In production | Bearer secret for `GET /api/cron/tick`. Outside production it defaults to `dev-cron-secret`. In production, if it's unset the route answers 503 to every call. |
| `SKIP_WORLD_ID` | In production | Whether new merchants skip human verification. See [World ID](#world-id-skip_world_id). |
| `PAYMENT_ROUTER_ADDRESS` | No | Overrides the router address on the server. It takes precedence over `NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS`. Default: the address in `packages/core/src/deployment.ts` (`0xa99a6D97607567f4fe734831910D24f4e9BD0508`). |
| `NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS` | No | Fallback router address when `PAYMENT_ROUTER_ADDRESS` is unset. Same default. Browser code doesn't read it directly: the widget gets the router from the session (`routerAddress`) and the refund dialog gets it from the server. |
| `NEXT_PUBLIC_WHITECHAIN_RPC_URL` | No. Default `https://rpc.testnet.whitechain.io` | RPC that browser code in both apps uses for chain 1874: the checkout widget's fallback read transport, the network it asks the wallet to add, and the dashboard's wallet connection. |
| `ALLOW_PRIVATE_WEBHOOK_URLS` | No | Set to `true` to allow webhook URLs on localhost and private addresses in production. Outside production they're always allowed. See [Webhook URL guard](#webhook-url-guard). |
| `INDEXER_STATE_KEY` | No, tests only | Name of the indexer cursor row. Default `payment_router`. The end to end test sets its own. Don't change it in a real deployment. |
| `NODE_ENV` | Set by Next.js | `next build` and `next start` run with `production`, which turns on the production behavior of `CRON_SECRET`, `SKIP_WORLD_ID`, the webhook URL guard and secure cookies. `pnpm worker` runs under `tsx`, which doesn't set it, so set `NODE_ENV=production` for the worker yourself. Otherwise the webhook URL guard is off for deliveries the worker sends. |

`NEXT_PUBLIC_` variables are inlined into browser code when the app is built, so rebuild after you change them.

### Demo store

| Variable | Required | Meaning |
| --- | --- | --- |
| `WC_SECRET_KEY` | Yes, to place orders | A `sk_test_` secret key from the dashboard's Developers page. Used server-side to create checkout sessions. |
| `WC_WEBHOOK_SECRET` | Yes, to receive webhooks | The `whsec_` signing secret of the store's webhook endpoint (Webhooks > Reveal). If it's missing, the webhook route answers 500 so deliveries are retried once it's fixed. |
| `WC_API_BASE` | No. Default `http://localhost:3000` | Dashboard base URL the store's server calls. |
| `NEXT_PUBLIC_WC_API_BASE` | No | Dashboard base URL the checkout widget calls from the browser. Defaults to `WC_API_BASE`, then `http://localhost:3000`. Not in `.env.example`. |
| `DEMO_STORE_URL` | No. Default `http://localhost:3001` | The store's own public URL, used for each session's `successUrl` and `cancelUrl`. Not in `.env.example`. |

Restart the store after changing its variables.

### In `.env.example` but not read by the code

| Variable | Notes |
| --- | --- |
| `DEPLOYER_ADDRESS` | The address of `DEPLOYER_PRIVATE_KEY`, kept for reference. No code reads it. |
| `WORLD_APP_ID`, `WORLD_ACTION` | Reserved for the planned World ID verification. Not used yet. |

## Cron tick instead of the worker

If you can't run a long-lived process, call the tick route on a schedule. Each call runs one indexer pass and sends due webhook deliveries (up to 4 batches of 25, so at most 100 per call), the same work as one loop of `pnpm worker`.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/tick
```

A successful response has this shape (the values are illustrative):

```json
{
  "ok": true,
  "indexer": { "fromBlock": "12373500", "toBlock": "12373540", "processed": 2 },
  "webhooks": { "attempted": 2 },
  "durationMs": 840
}
```

| Status | When |
| --- | --- |
| `200` | Both steps ran |
| `401` | Missing or wrong secret (`authentication_error`) |
| `500` | The indexer or the webhook step threw. The body has an `error` message for the failed step. |
| `503` | `CRON_SECRET` isn't set in production (`server_error`) |

The route exports `maxDuration = 60`, which serverless hosts use as the time limit per call. One pass scans at most 10 chunks of 2,000 blocks, so a cursor far behind catches up over several calls. Deliveries are claimed with row locks, so the worker and cron ticks can run at the same time without sending a delivery twice.

Retries only happen when something runs the delivery step, so the tick frequency sets how promptly the 1, 5 and 30 minute retries go out.

## Deploy the contract

The router is already deployed on Whitechain Sepolia at `0xa99a6D97607567f4fe734831910D24f4e9BD0508` (deploy block `12373441`). You only need to deploy your own if you want a router you own.

`script/Deploy.s.sol` deploys `PaymentRouter` with the official USDT (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`) and makes the deployer the owner. It refuses to run on any chain other than 1874.

```bash
export PATH="$HOME/.foundry/bin:$PATH"
bash contracts/install-deps.sh
cd contracts && set -a && . ../.env && set +a
forge test
forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.whitechain.io/ \
  --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast
```

The compiler settings are in `contracts/foundry.toml`: solc 0.8.30, optimizer with 200 runs, EVM version `prague`.

After deploying:

1. Set `PAYMENT_ROUTER_ADDRESS` and `PAYMENT_ROUTER_DEPLOY_BLOCK` in `packages/core/src/deployment.ts`. The indexer starts scanning from the deploy block.
2. Set `PAYMENT_ROUTER_ADDRESS` and `NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS` in `.env`, then rebuild.
3. Use the deployer's key as `DEPLOYER_PRIVATE_KEY`, since the owner is the only account that can register payout wallets.
4. Register merchants again. Payout registrations live in the old router and don't carry over. The dashboard treats submitting the current payout address as a no-op (the button reads "Already your payout wallet"), so a merchant can't simply re-save it. Either have each merchant switch to a different address, or clear `payout_address` and `registered_tx_hash` on the `merchants` rows so they register again.

### Verify the source

Blockscout verification on the Whitechain explorer:

```bash
cd contracts && forge verify-contract <router address> src/PaymentRouter.sol:PaymentRouter \
  --rpc-url https://rpc.testnet.whitechain.io/ \
  --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/ \
  --constructor-args $(cast abi-encode "constructor(address,address)" \
    0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7 <owner address>) --watch
```

The current router is verified both on the explorer and on [Sourcify](https://sourcify.dev/server/v2/contract/1874/0xa99a6D97607567f4fe734831910D24f4e9BD0508) (exact match). The explorer's verifier was briefly unavailable on deploy day; if Blockscout is down for you, use Sourcify. The explorer's "Verify & Publish" page also has a Sourcify method that imports an existing Sourcify match. With forge, the Sourcify verifier takes the chain id instead of an API URL:

```bash
cd contracts && forge verify-contract <router address> src/PaymentRouter.sol:PaymentRouter \
  --chain 1874 --verifier sourcify
```

## Production notes

### Build and start

```bash
pnpm --filter dashboard build && pnpm --filter dashboard start      # port 3000
pnpm --filter demo-store build && pnpm --filter demo-store start    # port 3001
pnpm worker                                                         # or schedule the cron tick
```

Serve the dashboard over HTTPS. In production the session cookie is `Secure`, so browsers won't keep the login on a plain HTTP origin.

### CRON_SECRET

Set a long random `CRON_SECRET` in production. Without it, `/api/cron/tick` rejects every call with 503, so nothing runs unless you also run the worker. The secret is compared in constant time.

### World ID (SKIP_WORLD_ID)

World ID human verification isn't built yet. A merchant's status is set once, at signup:

| `SKIP_WORLD_ID` | New merchants |
| --- | --- |
| `false` | `pending` |
| Any other non-empty value, such as `true` | `active` |
| Unset or empty, outside production | `active` |
| Unset or empty, in production | `pending` |

Pending merchants can't register a payout wallet, create keys or create checkout sessions, and there's no flow yet to make them active. So for a production deployment today, set `SKIP_WORLD_ID=true` explicitly. Changing the flag later doesn't change existing merchants.

### Webhook URL guard

In production, webhook URLs must point to public addresses. The check runs when an endpoint is created and again before every delivery, because DNS can change. It's on when the process running it has `NODE_ENV=production`, so set that for `pnpm worker` too (see [Environment variables](#environment-variables)).

- Only `http://` and `https://` URLs are accepted.
- Host names `localhost`, and names ending in `.localhost`, `.internal` or `.local`, are rejected.
- The host is resolved, and every address must be public. A host that doesn't resolve is rejected. Loopback, private, link-local (including cloud metadata), CGNAT, documentation, multicast and reserved IPv4 and IPv6 ranges are rejected, as are IPv4-mapped IPv6 addresses.
- A delivery to a blocked URL fails with `Blocked: ...` and isn't retried.
- Redirects aren't followed. A `3xx` response counts as a failed attempt.

Set `ALLOW_PRIVATE_WEBHOOK_URLS=true` only if your webhook receivers really live on a private network.

### Backend signer

The backend signer pays gas for every payout registration, so keep it funded with WBT. Payout changes are rate limited to one per merchant every 5 minutes, and new changes are refused while 60 or more merchants have changed their payout in the past hour. Registrations are queued one at a time within a server process to avoid nonce collisions, so running several dashboard instances that register payouts at the same moment can still collide.

### Demo store

The demo store is a sample, not a production pattern. Its `/admin` page is public, and it keeps orders in `apps/demo-store/data/orders.json`.

## Related

- [Testing](./testing.md)
- [Dashboard](./dashboard.md)
- [Smart contract](./smart-contract.md)
- [Webhooks](./webhooks.md)
