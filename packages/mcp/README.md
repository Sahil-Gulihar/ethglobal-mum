# @whitechain-commerce/mcp

Whitechain Commerce for AI agents. Lets any agent create USDT checkouts, share payment links, look up payments and start refunds, in any repository.

- **`npx @whitechain-commerce/mcp init`** wires the current repo for Claude Code, Cursor, VS Code and `AGENTS.md`.
- **`npx @whitechain-commerce/mcp`** is a stdio MCP server for clients that only run local commands.
- **`WhitechainAgentToolkit`** gives your own agent the same tools for the Claude Messages API, OpenAI or the Vercel AI SDK.

It has no dependencies. Everything goes through the hosted MCP endpoint (`/api/mcp`), so the tools always match the server.

## Setup

Create a secret key in the dashboard under **Developers**, then:

```bash
export WC_SECRET_KEY=sk_test_...
export WC_API_BASE=https://your-dashboard.example   # only if you self-host
```

## Add to a repository

```bash
npx @whitechain-commerce/mcp init            # all clients
npx @whitechain-commerce/mcp init --clients=claude,agents --dry-run
```

This merges a `whitechain` server into `.mcp.json`, `.cursor/mcp.json` and `.vscode/mcp.json`, and appends a Whitechain section to `AGENTS.md`. The files reference `WC_SECRET_KEY` and never contain the key.

## Stdio server

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

`npx @whitechain-commerce/mcp tools` lists the tools your key can use.

## Toolkit

```ts
import { WhitechainAgentToolkit } from "@whitechain-commerce/mcp";

const whitechain = new WhitechainAgentToolkit(); // or { secretKey, baseUrl }

await whitechain.anthropicTools();        // Claude Messages API `tools`
await whitechain.openAITools();           // OpenAI `tools`
await whitechain.aiSdkTools(jsonSchema);  // Vercel AI SDK, pass `jsonSchema` from "ai"

await whitechain.callTool("create_payment_link", { name: "Consulting call", amount: "25" });
// -> { ok: true, data: { id: "pl_...", url: "https://.../pay/pl_...", ... }, text: "..." }
```

`handleAnthropicToolUse(block)` and `handleOpenAIToolCall(call)` run a model's tool call and return the message to send back.

Full guide: [docs/developers/agents.md](../../docs/developers/agents.md).

## Safety

Agents can't move funds. Customers pay straight to the merchant's wallet, and refunds created by an agent stay pending until the merchant signs them with the payout wallet.
