# Whitechain Commerce: Fixed Spec & Build Plan

ETHGlobal Mumbai 2026

Whitechain Commerce is a drop-in, non-custodial USDT checkout on Whitechain.

- A merchant proves they are a unique human with World ID, gets an API key, and adds checkout to their store in about 20 lines.
- Customers pay in USDT through our payment contract.
- The merchant gets a signed webhook, sees the payment in the dashboard, and can issue full or partial refunds that are linked to the original order onchain.

UX reference: MoonPay Commerce (https://www.moonpay.com/business/commerce). All branding, UI and code are original.

## 1. Target prizes

| Track | Prize | What we can win |
| --- | --- | --- |
| Whitechain · Operate: Stablecoin Payments for Business (primary) | $5,000 pool | 1st $2,500 · 2nd $1,500 · 3rd $1,000 |
| World · Best Use of IDKit (secondary) | $2,500 pool | Up to 2 teams × $1,250 |

The best case is $3,750 (1st in Operate plus one IDKit award), subject to ETHGlobal eligibility rules.

Traps to avoid (from the Operate "won't place" list):

- A pay button that sends a plain ERC-20 transfer. Every payment goes through our PaymentRouter contract and emits an event linked to the order.
- Escrow on its own. The contract never holds funds. Payments go straight to the merchant, and refunds are pulled from the merchant.

## 2. Trust moment and credential choice

**Trust moment:** granting a new merchant access to payment infrastructure (API keys, payouts, webhooks).

**Credential:** Proof of Human.

- We need to know each merchant is one unique human, so one person can't create many merchant accounts to abuse refunds, spam checkouts or launder volume through fake stores.
- We don't need legal identity, nationality or age, so Passport/NFC would collect more than we need.
- That makes Proof of Human the minimum sufficient assurance.

How uniqueness is enforced:

- One IDKit action: `merchant-onboarding`.
- The proof is verified server-side.
- The nullifier is stored with a UNIQUE constraint.
- A second signup by the same human is rejected, even with a different email.

Paths we demo:

- **Success:** the account goes from `pending` to `active`, and API key creation unlocks.
- **Duplicate human (same nullifier):** the backend returns 409, the account stays `pending`, and a clear message is shown.
- **Cancelled verification:** the account stays `pending` and a retry button is shown.

Customers never need World ID.

## 3. Scope

### Must ship

| Module | Deliverable |
| --- | --- |
| Onboarding | Email signup, World ID verification (server-side), payout wallet |
| Contracts | PaymentRouter (pay, refund, events), deployed and verified on Whitechain Sepolia |
| API | Create checkout session, get payment, create refund, API key auth |
| React SDK | `<WhitechainCheckout />` component |
| Checkout widget | Connect wallet → approve USDT → pay → status |
| Settlement check | Backend validates the PaymentSettled log before marking an order paid |
| Webhooks | HMAC-signed `payment.succeeded` and `refund.succeeded`, retries, delivery log |
| Dashboard | Payments, status, explorer links, refund button, API keys, webhook logs |
| Demo store | A separate Next.js app that uses only the public SDK |

### Nice to have (only once the demo works end to end)

- Payment links: a URL that opens hosted checkout for a fixed amount.
- A receipt page with an explorer link.
- A revenue chart.

### Cut

Invoices, server SDK, PDF receipts, a full developer portal, Redis/BullMQ (replaced by a retry loop backed by the database), and subscriptions.

## 4. Flows

### Merchant

1. Create an account. Status is `pending`.
2. Verify with World ID (Proof of Human).
3. The backend verifies the proof and checks the nullifier.
   - Valid and unique: status becomes `active`.
   - Invalid, duplicate or cancelled: status stays `pending` and the reason is shown.
4. Set a payout wallet. The backend registers the merchant on PaymentRouter.
5. Create an API key. It is shown once.
6. Integrate the SDK into the store.
7. Receive payments and webhooks, and issue refunds.

### Customer

1. Open checkout on the demo store.
2. Connect a wallet and switch to chain 1874 if needed.
3. Approve USDT if the allowance is too low.
4. Call `PaymentRouter.pay(...)`.
5. The indexer sees `PaymentSettled`, validates it and marks the order paid.
6. A webhook goes to the store, the order is fulfilled, and a receipt with an explorer link is shown.

## 5. Developer integration (~20 lines)

```tsx
import { WhitechainCheckout } from "@whitechain-commerce/react";

export default function Checkout({ sessionId }: { sessionId: string }) {
  return (
    <WhitechainCheckout
      sessionId={sessionId}
      onSuccess={(payment) => {
        // UI only. Fulfil the order from the webhook, not here.
        window.location.href = `/orders/${payment.orderId}`;
      }}
      onError={(error) => console.error(error)}
    />
  );
}
```

The store's server creates the session with its secret key, so the amount can't be tampered with in the browser:

```ts
const res = await fetch("https://api.whitechain-commerce.dev/v1/checkout_sessions", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.WC_SECRET_KEY}` },
  body: JSON.stringify({ orderId: "order_456", amount: "49.99", currency: "USDT" }),
});
const { id: sessionId } = await res.json();
```

This is our own proposed SDK, not an existing package. The client callback is never proof of payment; orders are fulfilled only from the verified webhook.

## 6. Architecture

Repo layout (pnpm monorepo):

- `contracts/`: Foundry project with `PaymentRouter.sol` and its tests.
- `apps/dashboard/`: Next.js app with the dashboard, hosted checkout, API routes, and the indexer and webhook worker.
- `apps/demo-store/`: a separate shop that uses only the SDK.
- `packages/react/`: the `@whitechain-commerce/react` package.

Stack: Next.js, TypeScript, Tailwind, shadcn/ui, wagmi, viem, Solidity, Foundry, PostgreSQL (Neon or Supabase), World IDKit.

### PaymentRouter.sol

- `registerMerchant(bytes32 merchantId, address payout)`
  - `onlyOwner` (our backend signer).
  - Called after World ID verification succeeds.
- `pay(bytes32 merchantId, bytes32 orderId, uint256 amount)`
  - Calls `transferFrom` from the payer to the merchant's payout address.
  - Allows one payment per `(merchantId, orderId)`.
  - Emits `PaymentSettled(paymentId, merchantId, orderId, payer, amount)`.
- `refund(bytes32 paymentId, uint256 amount)`
  - Can only be called by the merchant's payout address.
  - Requires `refunded + amount <= paid`.
  - Calls `transferFrom` from the merchant back to the payer.
  - Emits `Refunded(paymentId, amount, totalRefunded)`.
- The USDT address is hardcoded. The contract holds no balances, so it stays non-custodial.
- Use OpenZeppelin `SafeERC20` and `ReentrancyGuard`.

### Settlement check (before marking an order paid)

The indexer polls `getLogs` and checks all of the following:

- The chain ID is 1874.
- The event comes from our PaymentRouter address.
- The token is the official USDT.
- The amount matches the session, using the token's real `decimals()` (read it onchain; don't assume).
- The merchant and order match the session.
- The transaction receipt shows success.

### Webhooks

- Signature: header `WC-Signature: t=<ts>,v1=<HMAC-SHA256(secret, ts + "." + body)>`.
- Idempotency: every event has a unique id, and receivers dedupe on it.
- Retries: driven from the `webhook_deliveries` table at 1 min, 5 min and 30 min, then the delivery is marked failed.
- Logs: every attempt is logged in the dashboard.

### API keys

- Format `sk_test_...`, shown once.
- Stored as a SHA-256 hash.
- Revocable from the dashboard.

### Database tables

- `merchants`: status, payout address, nullifier (UNIQUE)
- `api_keys`
- `checkout_sessions`
- `payments`
- `refunds`
- `webhook_endpoints`
- `webhook_deliveries`

## 7. Network configuration

| Parameter | Value |
| --- | --- |
| Network | Whitechain Sepolia (OP Stack L2) |
| Chain ID | 1874 |
| USDT | `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` |
| Explorer | https://explorer.testnet.whitechain.io |
| Faucet | https://faucet.testnet.whitechain.io |
| Docs | https://docs.whitechain.io |
| RPC | https://www.ankr.com/rpc/?utm_referral=Whitechain2026 |

The main demo must settle at least one payment in this official USDT. A self-minted token doesn't qualify.

## 8. Why Whitechain (README line)

Card rails can't give a merchant final settlement in seconds to a wallet they control, with no chargebacks, payout delays or cross-border fees. Whitechain USDT settlement does, and every payment and refund is linked to its order onchain so customers can verify it themselves.

## 9. Submission checklist

### Whitechain

- [ ] PaymentRouter deployed on Whitechain Sepolia (chain 1874)
- [ ] Contract verified on the explorer
- [ ] At least one official USDT payment in the main flow
- [ ] Payment and refund explorer links in the README
- [ ] "Why Whitechain" line in the README
- [ ] Public repo with commits every 1–2 hours (no single big push)
- [ ] README covering setup, architecture and limitations
- [ ] 2–4 minute video showing both the merchant and the customer
- [ ] `WHITECHAIN_FEEDBACK.md`

### World IDKit

- [ ] IDKit working with Proof of Human
- [ ] Proof verified server-side
- [ ] Success, duplicate-human and cancel paths all working
- [ ] README section on the trust moment and why Proof of Human is the minimum sufficient assurance
- [ ] Debrief covering time to first success, friction, missing docs, and the one improvement with the greatest impact

## 10. Build plan

Commit after every step.

| # | Step | Done when |
| --- | --- | --- |
| 1 | Scaffold the monorepo and Postgres; get WBT and USDT from the faucet for 2 wallets | Apps run and wallets are funded |
| 2 | Write PaymentRouter and Foundry tests (pay, double-pay blocked, partial refund, over-refund blocked) | Tests pass |
| 3 | Deploy and verify on Whitechain Sepolia | Verified contract link saved |
| 4 | Build hosted checkout: connect, switch chain, approve, pay | First real USDT payment on the explorer (qualifies early) |
| 5 | Signup, World ID, nullifier check and status gating | All 3 paths work |
| 6 | API keys and the checkout session API | Store creates a session with its secret key |
| 7 | Indexer and settlement validation | Order is marked paid only after all checks pass |
| 8 | React SDK and demo store | Demo store completes a purchase |
| 9 | Webhooks (signing, retries, log); store verifies the signature | Order is fulfilled from the webhook |
| 10 | Dashboard and partial refund button | Refund visible onchain and in the dashboard |
| 11 | README, `WHITECHAIN_FEEDBACK.md`, IDKit debrief | Checklist complete |
| 12 | Record the demo video | 2–4 min video uploaded |
| 13 | Nice-to-haves | Only if time remains |

Team split (2–4 people):

- **A:** contracts and indexer (steps 2, 3, 7)
- **B:** checkout, SDK and demo store (steps 4, 8)
- **C:** onboarding, World ID and API keys (steps 5, 6)
- **D**, or whoever frees up first: webhooks, dashboard and docs (steps 9–11)

Check these first:

- The USDT token's `decimals()`.
- How the Whitechain explorer verifies contracts (read the docs before step 3).
- How to test IDKit: the World ID simulator, the iOS sandbox (https://testflight.apple.com/join/Tub7zuyD) or the Android sandbox (https://appdistribution.firebase.dev/i/8333634946231041).
- Faucet limits.

## 11. Demo script (~3:30)

- **0:00** Pitch: human-verified, non-custodial USDT checkout on Whitechain.
- **0:15** Merchant signs up and verifies with World ID; the account becomes active.
- **0:45** A second signup with the same World ID is rejected and the account stays locked.
- **1:05** Merchant creates an API key and sets a webhook URL.
- **1:20** Show the ~20-line integration in the demo store.
- **1:40** Customer connects a wallet, approves and pays in USDT.
- **2:15** Show PaymentSettled on the explorer, the signed webhook arriving with its signature verified, the order fulfilled and the dashboard updated.
- **2:50** Merchant issues a partial refund, shown onchain and in the dashboard.
- **3:15** Close: what's onchain, why Whitechain, why Proof of Human.

## 12. Definition of done

A newly verified merchant can do all of the following:

- register
- get an API key
- embed checkout in a separate app
- accept the official Whitechain USDT
- receive a verified signed webhook
- see the payment in the dashboard
- issue a partial refund

The contract is verified, every qualifying transaction link is in the README, and the repo contains `WHITECHAIN_FEEDBACK.md` and the IDKit debrief.

## 13. Links

- Whitechain prizes: https://ethglobal.com/events/mumbai/prizes/whitechain
- World prizes: https://ethglobal.com/events/mumbai/prizes/world
- IDKit guide: https://docs.world.org/world-id/idkit/integrate
- IDKit JS example: https://idkit-js-example.vercel.app/
- Credentials: https://docs.world.org/world-id/idkit/credentials
- Proof of Human: https://docs.world.org/world-id/credentials/1
- Verification flows: https://docs.world.org/world-id/idkit/verification-flows
- World Developer Portal: https://developer.worldcoin.org
- World ID simulator: https://simulator.worldcoin.org/id/0x18310f83
- Foundry: https://getfoundry.sh
- wagmi: https://wagmi.sh
- viem: https://viem.sh
- OpenZeppelin: https://docs.openzeppelin.com/contracts
