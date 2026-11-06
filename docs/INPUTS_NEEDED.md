# Inputs needed from the team

Everything we need before the full build, from onboarding through the demo store. Items marked **Blocker** stop the step named next to them.

Never paste secrets in chat or commit them. Put them in the local `.env` files (they are gitignored) or a shared password manager.

## 1. Wallets and testnet funds

| # | Item | Blocks | Notes |
| --- | --- | --- | --- |
| 1.1 | **Deployer / backend-signer wallet** private key | Steps 3, 5 (Blocker) | Deploys PaymentRouter, becomes `owner`, and calls `registerMerchant`. Use a fresh hot wallet only. Needs WBT for gas. |
| 1.2 | **Merchant payout wallet** (address in a browser wallet) | Steps 4, 10 | Receives USDT. Signs `approve` + `refund`, so it needs WBT and a USDT allowance to the router. |
| 1.3 | **Customer wallet** (MetaMask/Rabby) with WBT + official USDT | Step 4 (Blocker) | Must hold the official USDT `0xcedf…55a7`, not a self-minted token. |
| 1.4 | Faucet limits: how much WBT/USDT per claim, cooldown | Step 1 | Tells us how many test payments we can afford. |

## 2. Whitechain network

| # | Item | Blocks | Notes |
| --- | --- | --- | --- |
| 2.1 | **RPC URL** (Ankr key or the public endpoint) | Steps 3, 4, 7 (Blocker) | The spec's Ankr link is a signup page, not an endpoint. |
| 2.2 | Explorer verification method (Blockscout API? API key?) | Step 3 | Tells us which `forge verify-contract` flags to use. |
| 2.3 | Confirm USDT `decimals()` | Step 2 | We can read it ourselves once we have an RPC. |

## 3. World ID / IDKit

| # | Item | Blocks | Notes |
| --- | --- | --- | --- |
| 3.1 | **World Developer Portal app ID** (`app_...`) | Step 5 (Blocker) | Create the app at https://developer.worldcoin.org. Use the staging environment so the simulator works. |
| 3.2 | **Action** `merchant-onboarding` created in that app | Step 5 (Blocker) | Proof of Human credential, max verifications per user = 1. |
| 3.3 | Any extra signing key or API key the portal shows for the current IDKit version (e.g. an RP or signing key) | Step 5 | Newer IDKit versions may need a server-side key. Send it if the portal shows one. |
| 3.4 | Testing method: simulator or the iOS/Android sandbox app | Step 5 | Two separate simulated identities are useful, plus one reused identity to demo the duplicate path. |

## 4. Infrastructure

| # | Item | Blocks | Notes |
| --- | --- | --- | --- |
| 4.1 | **Postgres connection string** (Neon or Supabase) | Step 1 (Blocker) | Or say "local", and we run Postgres in Docker. |
| 4.2 | Hosting choice for dashboard + demo store (Vercel?) | Steps 9, 12 | Webhooks need a public URL. Vercel or a tunnel (ngrok/cloudflared) both work. |
| 4.3 | Background worker hosting | Steps 7, 9 | The indexer and webhook retry loop need a long-running process or a cron job. Vercel cron is enough for the demo. |
| 4.4 | Email for signup: magic link (needs Resend etc.) or plain email + password | Step 5 | Recommend email + password to save time. |

## 5. Decisions

| # | Decision | Default if you don't answer |
| --- | --- | --- |
| 5.1 | Product name and domain | "Whitechain Commerce", localhost / Vercel URLs |
| 5.2 | Refund model: merchant signs `refund` from the payout wallet (as in the spec) | As in the spec |
| 5.3 | Session expiry window | 30 minutes |
| 5.4 | Amount format: decimal strings converted with onchain `decimals()` | As in the spec |
| 5.5 | Publish `@whitechain-commerce/react` to npm, or use it only as a workspace package | Workspace package only |
| 5.6 | Team split: who owns A/B/C/D | Not set |
| 5.7 | Brand: colours and logo for checkout and dashboard | Neutral shadcn theme |

## 6. Accounts and submission

| # | Item | Notes |
| --- | --- | --- |
| 6.1 | GitHub repo visibility (must be public by submission) | `origin` is `Sahil-Gulihar/ethglobal-mum` |
| 6.2 | ETHGlobal project page / team members | Needed for the submission |
| 6.3 | Who records the video and with which tool | Step 12 |

## 7. Local tooling

- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`). Not installed on this machine yet.
- pnpm and Node are already installed.
- Docker, only if we use local Postgres.
