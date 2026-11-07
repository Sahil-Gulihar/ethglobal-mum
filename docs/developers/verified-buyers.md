---
title: "Verified buyers"
description: "Stop checkout bots: buyers prove they're human with World ID or a 0G picture check, and you see which payments came from verified people."
---

Bots abuse open checkouts. They farm sessions, test stolen wallets, and spam limited drops. With **Verified buyers**, a person proves they're human before they pay, and every payment shows whether its buyer was verified. You pick how buyers verify:

- **World ID (default).** The buyer taps **Verify with World ID** and approves in World App. It's the same World ID check merchants pass at signup. The proof is bound to that one checkout, verified with World's Developer Portal, and the store never learns who the buyer is.
- **0G picture check.** The buyer names what's in a fresh picture drawn on [0G Private Computer](https://pc.0g.ai). No app needed. It's described below.

## How the 0G picture check works

1. **A fresh picture.** 0G's `z-image-turbo` image model, running in a TEE, draws a new picture for each check, for example "one purple teapot on a sandy beach." Only our server knows the answer. Pictures are never reused, so there is no pool for a bot to scrape.
2. **Type it or say it.** The buyer writes what they see, or presses the mic and says it. Voice answers are transcribed by `whisper-large-v3` on 0G.
3. **0G judges the answer.** `0gm-1.0-35b-a3b`, also in a TEE, decides whether the answer matches. It accepts synonyms, typos, and other languages ("navy kettle" passes for a blue teapot).

Each check allows 3 answers. A checkout allows 4 pictures, and answers that come in faster than a person could look at the picture are rejected. Every 0G call's router request ID is stored with the check and shown to the buyer and the merchant.

## Sign in with 0G

Buyers can connect their own 0G account from the checkout: **Sign in with 0G**, then paste a 0G management key with the `account:read` and `keys:create` scopes. You create one at [pc.0g.ai → API keys](https://pc.0g.ai/dashboard/api-keys).

- Whitechain reads the buyer's 0G account address and credit balance with that key. It also creates an inference key on the buyer's account that is capped at 0.5 per day, resets daily, and can only call the three models above. The keys are stored AES-256-GCM encrypted.
- Checks then **spend the buyer's own 0G credits**, including iAI daily credits. The checkout shows the balance before and after.
- A buyer who passes gets a **Verified buyer** badge for 30 days. While it's active, their next checkout at any Whitechain store skips the picture.
- Buyers who don't sign in can still verify as guests. The store's platform 0G key pays for their check, but no badge carries over.

Making each attempt cost real 0G credits is the point. A bot farm that wants to look human pays 0G for every try.

## Turn it on

Verified buyers is switched on in code, per checkout. Pass `requireVerifiedBuyer: true` when your server creates the checkout session:

```ts
import { createCheckoutSession } from "@whitechain-commerce/react/server";

const session = await createCheckoutSession({
  secretKey: process.env.WC_SECRET_KEY!,
  orderId: order.id,
  amount: "4.99",
  requireVerifiedBuyer: true, // buyer verifies with World ID before paying
});
```

Over plain HTTP, send the same field to `POST /api/v1/checkout_sessions`. With Python, pass `require_verified_buyer=True`. To use the 0G picture check instead of World ID, also send `verifiedBuyerMethod: "zg"`.

- **`requireVerifiedBuyer: true`:** the hosted checkout shows a small **Verify with World ID** row inside the checkout card, and the pay steps appear only after the proof passes. The embedded widget sends buyers to the hosted checkout to verify.
- **Left out (default):** no check. The checkout works as before.

The [demo store](https://demo.100lana.com) sets `requireVerifiedBuyer: true` on every order.

## See it on payments

- **Payments** and the payment page show a **Verified buyer** badge. The payment page also lists the 0G request IDs for that buyer's check.
- The `payment.succeeded` webhook and the Payments API include `buyerVerified: true | false`, and `buyerVerifiedVia` (`"world_id"`, `"zg"` or `"zg_badge"`):

```json
{ "type": "payment.succeeded", "data": { "payment": { "id": "pay_…", "amount": "4.99", "buyerVerified": true, "buyerVerifiedVia": "world_id" } } }
```

The PaymentRouter contract stays permissionless, so anyone can still call `pay` directly. If you want to be strict, fulfil only orders where `buyerVerified` is `true`.

## Self-hosting

World ID buyer checks reuse the merchant World ID setup (`WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNER_PRIVATE_KEY`, `WORLD_ENVIRONMENT`). They use `WORLD_ACTION` unless you set `WORLD_BUYER_ACTION` to a separate action. Apply `apps/dashboard/sql/2026-11-07-verified-buyers-world-id.sql` after the file below.

For the 0G picture check, set `ZG_API_KEY` (an `sk-` key from pc.0g.ai) to pay for guest checks. `BUYER_KEY_SECRET` encrypts buyers' keys and defaults to `CRON_SECRET`. Optional settings: `ZG_ROUTER_URL`, `ZG_IMAGE_MODEL`, `ZG_JUDGE_MODEL`, `ZG_ASR_MODEL`, and `ZG_TRUST_MODE` (default `private`, which pins every call to TEE providers). Apply `apps/dashboard/sql/2026-11-07-verified-buyers.sql` to your database.
