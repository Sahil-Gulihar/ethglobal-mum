# Frozen interfaces (build contract between workstreams)

Read this before writing code. If you must change something here, change it in the same commit and say so in your report.

World ID is **deferred**. Merchants are `active` on signup while `SKIP_WORLD_ID=true`. Keep the `status` column and `requireActive` checks so World ID can be added later.

## Shared code (already written, import it, don't duplicate)

| Path | What |
| --- | --- |
| `packages/core/src/chain.ts` | `whitechainSepolia` (viem chain), `USDT_ADDRESS`, `EXPLORER_URL`, `explorerTx()`, `PUBLIC_RPC_URL` |
| `packages/core/src/abi.ts` | `paymentRouterAbi`, `erc20Abi` (frozen PaymentRouter ABI) |
| `packages/core/src/deployment.ts` | `getRouterAddress()`, `PAYMENT_ROUTER_DEPLOY_BLOCK` (contracts agent fills these in) |
| `packages/core/src/ids.ts` | `chainMerchantId(merchant.id)`, `chainOrderId(session.id)`, `chainPaymentId(m, o)` |
| `packages/core/src/money.ts` | `toUnits("49.99", 6)`, `fromUnits(units, 6)` |
| `packages/core/src/types.ts` | `PublicCheckoutSession`, `CheckoutSession`, `ApiError` |
| `packages/core/src/webhooks.ts` (import `@whitechain-commerce/core/webhooks`, Node only) | `signWebhook`, `verifyWebhook`, `WebhookEvent`, `PaymentObject`, `RefundObject` |
| `apps/dashboard/src/lib/db/` | Drizzle `db` + all tables (`schema.ts`). Don't edit the schema without saying so. |
| `apps/dashboard/src/lib/auth.ts` | `hashPassword`, `verifyPassword`, `startSession`, `endSession`, `getCurrentMerchant`, `requireMerchant` |
| `apps/dashboard/src/lib/api-auth.ts` | `merchantFromApiKey(req)`, `apiError()`, `corsHeaders` |
| `apps/dashboard/src/lib/chain.ts` | `publicClient()`, `backendWallet()`, `usdtDecimals()`, `registerMerchantOnchain()` |
| `apps/dashboard/src/lib/ids.ts` | `newId("cs")` → `cs_xxx`, `sha256()` |

## Onchain

- `merchantId = keccak256(utf8(merchant.id))`, stored in `merchants.chain_merchant_id`.
- `orderId = keccak256(utf8(checkoutSession.id))`, stored in `checkout_sessions.chain_order_id`. One session = at most one payment.
- `paymentId = keccak256(abi.encode(merchantId, orderId))`.
- USDT has 6 decimals (verified onchain). Server code still reads `decimals()` through `usdtDecimals()`.

PaymentRouter (`contracts/src/PaymentRouter.sol`), matching `abi.ts`:

```solidity
constructor(address usdt, address owner)             // deploy with the official USDT
function registerMerchant(bytes32 merchantId, address payout) external onlyOwner // also updates the payout
function merchantPayout(bytes32 merchantId) external view returns (address)
function pay(bytes32 merchantId, bytes32 orderId, uint256 amount) external returns (bytes32 paymentId)
  // reverts if the merchant is unregistered, amount == 0, or (merchantId, orderId) is already paid
  // safeTransferFrom(msg.sender -> payout, amount); stores Payment; emits PaymentSettled
function refund(bytes32 paymentId, uint256 amount) external
  // only the merchant's CURRENT payout; refunded + amount <= amount paid
  // safeTransferFrom(payout -> payer, amount); emits Refunded
function getPayment(bytes32) external view returns (Payment{merchantId, orderId, payer, amount, refunded})
function paymentIdOf(bytes32 merchantId, bytes32 orderId) external pure returns (bytes32)
event MerchantRegistered(bytes32 indexed merchantId, address payout)
event PaymentSettled(bytes32 indexed paymentId, bytes32 indexed merchantId, bytes32 indexed orderId, address payer, address payout, address token, uint256 amount)
event Refunded(bytes32 indexed paymentId, address indexed payer, uint256 amount, uint256 totalRefunded)
```

The contract never holds a balance (non-custodial). Refunds need the payout wallet to `approve(router, amount)` first.

## HTTP API (apps/dashboard, port 3000)

All errors use `{ "error": { "type", "message" } }`. CORS is open on `/api/v1/*`.

| Method & path | Auth | Body / result |
| --- | --- | --- |
| `POST /api/v1/checkout_sessions` | `Bearer sk_test_` | `{ orderId, amount: "49.99", currency: "USDT", successUrl?, cancelUrl?, metadata? }` → `CheckoutSession` (201). Merchant must be active **and** have a payout registered. Expires in 30 min. |
| `GET /api/v1/checkout_sessions/:id` | none (public) | → `PublicCheckoutSession`. Lazily marks expired sessions `expired` (unless `processing`). |
| `POST /api/v1/checkout_sessions/:id/submit` | none | `{ txHash }` → `{ ok: true }`. Stores the hint, sets the status to `processing`, and triggers a validation attempt for that tx. **Never** marks a session paid without validation. |
| `GET /api/v1/payments` | `Bearer` | `?limit=` → `{ data: PaymentObject[] }` |
| `GET /api/v1/payments/:id` | `Bearer` | → `PaymentObject` |
| `POST /api/v1/refunds` | `Bearer` | `{ paymentId, amount }` → `RefundObject` with status `pending`. The merchant confirms it from the dashboard by signing with the payout wallet (non-custodial, the API cannot move funds). |
| `GET /api/cron/tick` | `Authorization: Bearer $CRON_SECRET` | Runs one indexer pass plus due webhook deliveries. `scripts/worker.ts` loops on the same functions every 4 s. |

Hosted checkout: `GET /checkout/:sessionId` (dashboard page) renders `<WhitechainCheckout sessionId apiBase="" />` from the SDK, full page.

## Lib entry points (owned by the indexer/webhooks agent)

- `src/lib/indexer/index.ts`: `runIndexerOnce(): Promise<{ fromBlock, toBlock, processed }>` and `validateTx(txHash)`. Both run the full settlement check (SPEC §6) and are idempotent.
- `src/lib/webhooks/index.ts`: `enqueueEvent(merchantId, type, payloadBuilder)` (creates one event plus one delivery per enabled endpoint) and `deliverDue(): Promise<number>`. Retry schedule after a failure: +1 min, +5 min, +30 min, then `failed`. Every attempt goes into `webhook_attempts`. 10 s timeout. Any 2xx counts as success.
- Serializers in `src/lib/serializers.ts` (already written): `toPaymentObject(paymentRow, sessionRow)`, `toRefundObject(...)`, `toPublicSession(...)`, `toCheckoutSession(...)`. The indexer imports these to build webhook payloads.

## Webhook format

```
POST <endpoint url>
Content-Type: application/json
WC-Signature: t=<unix>,v1=<hex hmac_sha256(secret, t + "." + rawBody)>
User-Agent: WhitechainCommerce-Webhooks/1.0

{ "id": "evt_...", "type": "payment.succeeded", "created": 1700000000, "data": { "payment": PaymentObject } }
{ "id": "evt_...", "type": "refund.succeeded",  "created": ..., "data": { "refund": RefundObject, "payment": PaymentObject } }
```

Receivers dedupe on `id`.

## React SDK (`packages/react`)

```tsx
import { WhitechainCheckout } from "@whitechain-commerce/react";
<WhitechainCheckout
  sessionId="cs_..."
  apiBase="http://localhost:3000"   // optional; defaults to NEXT_PUBLIC_WC_API_BASE, then "" (same origin)
  onSuccess={(r: { sessionId; orderId; paymentId; txHash; explorerUrl; successUrl; alreadyPaid }) => {}}
  onError={(e: Error) => {}}
/>
// server helpers:
import { verifyWebhook, createCheckoutSession } from "@whitechain-commerce/react/server";
```

The SDK talks to the browser wallet directly over EIP-1193/EIP-6963 using viem. The merchant doesn't need wagmi. Flow: load the session → connect → switch/add chain 1874 → check balance → `approve` if the allowance is too low → `pay` → POST `/submit` → poll the session until `paid` (backend-validated) → `onSuccess`. Styles are self-contained, with no Tailwind dependency in the host app.

## Ports and env

- Dashboard on `:3000`, demo store on `:3001`.
- Root `.env` is loaded by both apps (`next.config.ts` `loadEnvConfig("../..")`). See `.env.example`.
- Postgres: `docker compose up -d db`, then `pnpm db:push`. URL: `postgres://wc:wc@localhost:5433/whitechain_commerce`.

### Indexer/webhooks as built (note from the indexer agent)

- `enqueueEvent(txOrDb, merchantId, type, data)`: the first argument is the Drizzle transaction (or `db`) so the event commits atomically with the state change; `data` is the event's `data` object (`{ payment }` or `{ refund, payment }`).
- `validateTx(txHash)` returns `{ ok: true, results }` or `{ ok: false, reason: "pending" | "reverted" | "no_router_events" | "invalid" }`.
- Dashboard helpers in `src/lib/webhooks`: `sendTestEvent(endpointId, merchantId?)` (synthetic `payment.succeeded` with `pay_test_...` ids, sent now) and `redeliver(deliveryId, merchantId?)` (sends now and resets the retry schedule). Both return `{ ok, statusCode, error, durationMs, attempt, status }` and throw "not found" when the id doesn't belong to `merchantId`.
- Each indexer pass also re-checks `processing` sessions that have a `submittedTxHash`: if the hinted tx is mined but didn't pay that session, the session goes back to `open` (or `expired`).
- The indexer skips work while the router address is the zero address, so the cursor can't move past the real deploy block.
- Node scripts that import `server-only` modules: `import "<...>/src/lib/indexer/node-shim"` first, then dynamic-import the modules.
