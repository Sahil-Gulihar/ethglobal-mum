---
title: "Integrate with AI"
description: "Paste one prompt into your coding agent and it adds Whitechain Commerce checkout, webhooks and an order status page to your repository."
---

Whitechain Commerce publishes an integration guide written for coding agents such as Claude Code, Cursor and Codex. It is a single Markdown page with instructions the agent follows end to end inside your repository: what to look at first, which checkout to pick, the exact environment variables, complete server and client code, the security rules, how to test on testnet, and a checklist it has to verify before it says it is done.

## The one-line prompt

Open your coding agent in the root of your repository and paste:

```text
Read https://whitechain-dashboard.vercel.app/integrate.md?stack=nextjs and integrate Whitechain Commerce checkout into this repo.
```

If you self-host, use your own dashboard URL: `{APP_URL}/integrate.md?stack=nextjs`. The guide fills in that URL as the API base everywhere.

Change `stack` to match your project. The agent reads the guide over HTTP, so it works with any agent that can fetch a URL.

## Stacks and modes

| `stack` | Use for | Default `mode` |
| --- | --- | --- |
| `nextjs` | Next.js App Router: route handlers, a client component for the widget, a webhook route and an order status page | `widget` |
| `react-node` | A React frontend (Vite or similar) with an Express-style Node.js backend | `widget` |
| `node` | A Node.js server (Express, Fastify, NestJS...) with server-rendered pages | `hosted` |
| `other` (default) | Anything else. Generic Node.js reference code plus how to read the raw webhook body and verify the signature in Next.js Pages Router, Fastify, NestJS, Hono, Django, Flask, Rails, Laravel and Go | `hosted` |

| `mode` | What the agent builds |
| --- | --- |
| `widget` | Embeds [`<WhitechainCheckout />`](./checkout-widget.md) so the customer pays on your page. Needs React 18+ and `@whitechain-commerce/react`. |
| `hosted` | Redirects the customer to the [hosted checkout](./hosted-checkout.md) at `session.url`. Works with any backend. |
| `payment-link` | No code: puts a fixed-price payment link (from **Payment links** in the dashboard or the `create_payment_link` MCP tool) behind a button. The guide is short and needs no keys in the repository. |

Example: `.../integrate.md?stack=node&mode=hosted`. Invalid values return `400` with the allowed values.

`@whitechain-commerce/react` is not published to npm yet. The guide tells the agent to check whether it can install it and to fall back to the hosted checkout if not. The server code in the guide has no Whitechain dependencies: it calls the API with `fetch` and verifies webhooks with `node:crypto`.

## What the agent will do

1. Inspect your repository: framework and version, where orders and totals live, how env vars are handled, existing payment and fulfilment code.
2. Pick widget, hosted checkout or payment link, using the guide's decision table.
3. Add `WC_SECRET_KEY`, `WC_WEBHOOK_SECRET` and `WC_API_BASE` (plus `NEXT_PUBLIC_WC_API_BASE` for the widget in Next.js) to your env handling and `.env.example`.
4. Add a server route that creates a [checkout session](./checkout-sessions.md) with your order id as `orderId` and an amount computed on the server.
5. Add the checkout UI: the widget, or a redirect to the hosted page.
6. Add a [webhook](./webhooks.md) route that verifies `WC-Signature` on the raw body, dedupes on the event id, and marks the order paid only when the amount matches.
7. Add an order status page that polls your own database until the webhook has arrived.
8. Test signature verification against the documented test vector, and walk you through a [testnet payment](./testing.md).

The guide's security rules are strict: the secret key stays on the server, the browser never decides the amount, orders are fulfilled only from a verified `payment.succeeded` webhook, test events (`pay_test_...`) are ignored, and refunds are left for you to sign with your payout wallet.

Some steps still need you: creating the account and registering a payout wallet, creating the secret key, and paying from a wallet that holds testnet USDT and WBT.

## Give the agent the MCP tools too

If the agent is connected to the [Whitechain Commerce MCP server](./agents.md), the guide tells it to use the tools instead of sending you to the dashboard: `get_account` to check that the account can accept payments, `create_webhook_endpoint` to register the webhook URL and get its signing secret for `WC_WEBHOOK_SECRET`, `send_test_webhook` to check verification, and `create_checkout_session` and `get_checkout_session` to test.

To set that up in a repository, run this in its root:

```bash
npx whitechain-mcp init
export WC_SECRET_KEY=sk_test_...
```

`init` adds the `whitechain` server to `.mcp.json`, `.cursor/mcp.json` and `.vscode/mcp.json`, and a short Whitechain Commerce section to `AGENTS.md` so every agent working in the repository knows how payments work there. See [Agents and MCP](./agents.md#add-it-to-any-repository).

## Related

- [Quickstart](./quickstart.md)
- [Agents and MCP](./agents.md)
- [Checkout sessions](./checkout-sessions.md)
- [Webhooks](./webhooks.md)
- [Testing](./testing.md)
