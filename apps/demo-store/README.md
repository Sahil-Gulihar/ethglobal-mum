# Chai & Co. (demo merchant)

A small fictional store that sells chai and takes **USDT** through Whitechain Commerce.
It uses only the public SDK (`@whitechain-commerce/react` and `@whitechain-commerce/react/server`), the same
way an outside merchant would.

| Route | What it does |
| --- | --- |
| `/` | Product grid, cart drawer, "Checkout with USDT" |
| `POST /api/orders` | Prices the cart **server-side** from `src/lib/catalog.ts`, stores the order in `data/orders.json`, calls `createCheckoutSession` with the secret key, returns `{ orderId, sessionId }` |
| `/checkout/[orderId]` | Order summary plus `<WhitechainCheckout />` (see `pay.tsx`, the whole client integration) |
| `POST /api/webhooks/whitechain` | Verifies `WC-Signature` against the raw body, dedupes on `event.id`, marks orders paid on `payment.succeeded` and records `refund.succeeded` |
| `/orders/[id]` | Polling order status page. It flips to "Fulfilled via verified webhook ✓" only after the webhook arrives |
| `/admin` | Orders plus the webhook log with "signature verified" badges |

Orders are paid **only** by the webhook handler. The browser's `onSuccess` callback just redirects to the order page.

## Setup

1. Start the dashboard (`pnpm --filter dashboard dev`, port 3000) and its worker (`pnpm --filter dashboard worker`),
   which indexes payments and delivers webhooks.
2. In the dashboard (http://localhost:3000):
   - Sign up as a merchant and set your **payout wallet**.
   - Create an **API key** and copy the `sk_test_...` secret.
   - Add a **webhook endpoint** with URL `http://localhost:3001/api/webhooks/whitechain` and copy its signing secret.
3. Put the values into the **repo root** `.env` (never commit it):

   ```bash
   WC_API_BASE=http://localhost:3000
   WC_SECRET_KEY=sk_test_xxx            # from step 2
   WC_WEBHOOK_SECRET=whsec_xxx          # from step 2
   # optional, defaults to WC_API_BASE, used by the browser checkout widget
   NEXT_PUBLIC_WC_API_BASE=http://localhost:3000
   ```

   `next.config.ts` loads the root `.env` via `loadEnvConfig`. Restart the store after editing it.

## Run

```bash
pnpm --filter demo-store dev      # http://localhost:3001
pnpm --filter demo-store typecheck
pnpm --filter demo-store build
```

Order data lives in `apps/demo-store/data/orders.json` (gitignored). Delete it to reset the store.

## Testing the webhook by hand

```bash
# Bad signature -> 400, shows up as "Signature rejected" in /admin
curl -i -X POST http://localhost:3001/api/webhooks/whitechain \
  -H 'content-type: application/json' -H 'wc-signature: t=1,v1=00' -d '{}'
```

A correctly signed event can be produced with `signWebhook(secret, body, timestamp)` from
`@whitechain-commerce/core/webhooks`.
