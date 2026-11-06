---
title: "Agents and MCP"
description: "Connect Claude, ChatGPT, Cursor, VS Code or your own agent to Whitechain Commerce over the Model Context Protocol."
---

Whitechain Commerce has a hosted [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. Any MCP client can use it to create checkouts, share payment links, look up payments and start refunds for your account. You can also add it to any repository, or give your own agent the same tools with the `@whitechain-commerce/mcp` package.

Agents can't move funds. Payments go straight from the customer's wallet to yours, and a refund an agent creates stays `pending` until you sign it with your payout wallet in the dashboard.

The dashboard's **Agents** page (`/dashboard/agents`) shows every snippet below with your dashboard URL already filled in.

## The server

| | |
| --- | --- |
| URL | `https://whitechain-dashboard.vercel.app/api/mcp` (or `{APP_URL}/api/mcp` if you self-host) |
| Transport | Streamable HTTP, stateless JSON responses |
| Auth | `Authorization: Bearer sk_test_...` |
| Connector URL | `{APP_URL}/api/mcp/sk_test_...`, for clients that only accept a URL |
| Protocol versions | `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05` |

Create a secret key under **Developers** first. The agent acts as the merchant who owns the key; revoke the key to cut it off.

## Connect an agent with approval

An agent can get its own key without anyone copying a secret around. The agent makes the key, you approve it in the dashboard, and the key starts working.

1. The agent generates a secret key on its own machine (`sk_test_` plus 32 random characters) and computes its SHA-256.
2. It shows you a link, `{APP_URL}/connect?h={sha256}&p={first 12 characters}&n={agent name}`, and a confirmation code such as `7F3A-91C2`.
3. You open the link while logged in to the dashboard (you're sent to log in first if needed). The page shows the agent's name, the same confirmation code, the key prefix and what the agent can do. Check that the codes match, then choose **Approve and connect**.
4. The agent polls the MCP server with its key (`tools/call get_account`). Once you approve, the call stops returning `401` and the agent is connected.

Your account must be verified before you can approve an agent. The key shows up under **Developers** as `Agent: {name}`.

### From the command line

```bash
npx @whitechain-commerce/mcp login --name="Release bot" --save=.env.local
```

It prints the link and the confirmation code, waits up to 10 minutes, then prints `Connected as {business name}` and writes `WC_SECRET_KEY=...` to the file given with `--save` (replacing an existing `WC_SECRET_KEY` line). It never prints the full key unless you pass `--print-key`. Use `--base-url=URL` (or `WC_API_BASE`) if you self-host, and `--timeout=SECONDS` to wait longer or shorter.

### From code

```ts
import { startConnect, WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const connect = await startConnect({ clientName: "Support agent" }); // baseUrl defaults to WC_API_BASE
console.log(`Approve at ${connect.approveUrl} (code ${connect.code})`);

const account = await connect.waitForApproval(); // { timeoutMs, intervalMs, signal } are optional
await saveSecret(connect.secretKey);              // your own secret storage

const whitechain = new WhitechainAgentToolkit({ secretKey: connect.secretKey });
```

`waitForApproval` resolves with the `get_account` result and rejects after the timeout (10 minutes by default) or when the signal aborts.

### Security model

- The key never leaves the agent's machine before approval. The link carries only its SHA-256 and the 12-character prefix, which is what the dashboard stores for every key anyway.
- Nothing happens until a logged-in merchant approves. Each link works once: approving the same hash again says it's already connected.
- The confirmation code ties the page you're looking at to the key your agent made. Only approve a link you started yourself, and only if the codes match. Someone who sends you their own link is asking for access to your account.
- A connected agent can do what any secret key can do. It can't change your payout wallet, sign refunds, create or revoke keys, or verify your identity.
- Revoke the key under **Developers** to cut the agent off.

## Add it to any repository

Run this in the root of the repository you want agents to work in:

```bash
npx @whitechain-commerce/mcp init
export WC_SECRET_KEY=sk_test_...
```

`init` merges a `whitechain` server into `.mcp.json` (Claude Code), `.cursor/mcp.json` (Cursor) and `.vscode/mcp.json` (VS Code), and adds a short Whitechain section to `AGENTS.md` so coding agents know how payments work in the project. The files only reference `WC_SECRET_KEY`, so they're safe to commit. Running it again doesn't duplicate anything.

| Flag | Meaning |
| --- | --- |
| `--clients=claude,cursor,vscode,agents` | Only write some of the files (default: all) |
| `--base-url=URL` | Your dashboard URL if you self-host (or set `WC_API_BASE`) |
| `--dry-run` | Print the changes without writing them |

## Connect a client

### Claude Code

```bash
claude mcp add --transport http whitechain https://whitechain-dashboard.vercel.app/api/mcp \
  --header "Authorization: Bearer $WC_SECRET_KEY"
```

Add `--scope project` to save it to the repository's `.mcp.json` for your whole team.

### Claude and ChatGPT custom connectors

In **Settings > Connectors > Add custom connector**, paste the connector URL with your key in it:

```
https://whitechain-dashboard.vercel.app/api/mcp/sk_test_...
```

Anyone with this URL can act as your account, so treat it like the key itself.

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "whitechain": {
      "url": "https://whitechain-dashboard.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer ${env:WC_SECRET_KEY}" }
    }
  }
}
```

### VS Code

`.vscode/mcp.json`. VS Code asks for the key once and keeps it in its secret storage:

```json
{
  "inputs": [
    { "type": "promptString", "id": "whitechain-secret-key", "description": "Whitechain Commerce secret key", "password": true }
  ],
  "servers": {
    "whitechain": {
      "type": "http",
      "url": "https://whitechain-dashboard.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer ${input:whitechain-secret-key}" }
    }
  }
}
```

### Claude Desktop and other stdio clients

Clients that can only start a local command can run the package, which passes messages to the hosted server:

```json
{
  "mcpServers": {
    "whitechain": {
      "command": "npx",
      "args": ["-y", "@whitechain-commerce/mcp"],
      "env": { "WC_SECRET_KEY": "sk_test_..." }
    }
  }
}
```

## Tools

| Tool | Access | What it does |
| --- | --- | --- |
| `get_account` | Read | Business name, verification status, payout wallet, network and contract addresses |
| `get_sales_summary` | Read | Lifetime payment count, gross, refunded and net USDT |
| `create_checkout_session` | Write | Creates a checkout for `amount` and returns the hosted checkout `url`. `orderId` is optional and acts as the idempotency key |
| `get_checkout_session` | Read | Session status: `open`, `processing`, `complete` or `expired` |
| `list_payments` | Read | Confirmed payments, newest first (`limit` 1 to 100) |
| `get_payment` | Read | One payment with its refunds |
| `create_refund` | Write | Creates a pending full or partial refund and returns the `approveUrl` where you sign it |
| `list_refunds` | Read | Refunds, optionally for one `paymentId` |
| `create_payment_link` | Write | A reusable fixed-price link (`/pay/pl_...`) |
| `list_payment_links` | Read | Links with their url, price, on/off state and takings |
| `set_payment_link_active` | Write | Turns a link on or off |

Amounts are USDT decimal strings such as `"25.00"`. Sessions created by an agent get `metadata.source = "mcp"`, so you can tell them apart in webhooks. Tools report problems, such as an amount larger than what's left to refund, as tool errors the agent can read and fix; they use the same rules as the [API](./api-reference.md).

## Build your own agent

`@whitechain-commerce/mcp` also exports `WhitechainAgentToolkit`, which turns the same tools into definitions for the Claude Messages API, OpenAI and the Vercel AI SDK. It has no dependencies and reads `WC_SECRET_KEY` and `WC_API_BASE` from the environment.

```bash
npm install @whitechain-commerce/mcp
```

### Claude Messages API

```ts
import Anthropic from "@anthropic-ai/sdk";
import { WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const client = new Anthropic();
const whitechain = new WhitechainAgentToolkit();

const messages: Anthropic.MessageParam[] = [
  { role: "user", content: "Make a 25 USDT payment link for a consulting call" },
];
const tools = await whitechain.anthropicTools();

while (true) {
  const res = await client.messages.create({ model: "claude-opus-5-5", max_tokens: 1024, tools, messages });
  messages.push({ role: "assistant", content: res.content });
  if (res.stop_reason !== "tool_use") break;
  const results = await Promise.all(
    res.content.filter((b) => b.type === "tool_use").map((b) => whitechain.handleAnthropicToolUse(b)),
  );
  messages.push({ role: "user", content: results });
}
```

### Vercel AI SDK

```ts
import { generateText, jsonSchema, stepCountIs } from "ai";
import { WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const whitechain = new WhitechainAgentToolkit();

const { text } = await generateText({
  model: "anthropic/claude-opus-5-5",
  tools: await whitechain.aiSdkTools(jsonSchema),
  stopWhen: stepCountIs(5),
  prompt: "How much did I sell, and which payment link earned the most?",
});
```

### OpenAI

```ts
import OpenAI from "openai";
import { WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const openai = new OpenAI();
const whitechain = new WhitechainAgentToolkit();

const res = await openai.chat.completions.create({
  model: "gpt-5",
  tools: await whitechain.openAITools(),
  messages: [{ role: "user", content: "Create a 49.99 USDT checkout for order 1042" }],
});
for (const call of res.choices[0].message.tool_calls ?? []) {
  const toolMessage = await whitechain.handleOpenAIToolCall(call);
  // append toolMessage and call the model again
}
```

### Toolkit reference

| Method | Returns |
| --- | --- |
| `new WhitechainAgentToolkit({ secretKey?, baseUrl?, fetch? })` | A toolkit bound to one merchant |
| `listTools()` | Tool names, descriptions and JSON Schema inputs (cached) |
| `callTool(name, args)` | `{ ok, data, text }`. `ok` is `false` for tool errors instead of throwing |
| `anthropicTools()` / `openAITools()` / `aiSdkTools(jsonSchema)` | Tool definitions for each SDK |
| `handleAnthropicToolUse(block)` | The matching `tool_result` block |
| `handleOpenAIToolCall(call)` | The matching `role: "tool"` message |

## Raw HTTP

The server is plain JSON-RPC over HTTP, so you can call it without any SDK:

```bash
curl -X POST https://whitechain-dashboard.vercel.app/api/mcp \
  -H "Authorization: Bearer $WC_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_sales_summary","arguments":{}}}'
```

A missing or revoked key returns HTTP `401` with JSON-RPC error `-32001`. The server is stateless: it doesn't issue `Mcp-Session-Id` and doesn't offer an SSE stream on `GET`.
