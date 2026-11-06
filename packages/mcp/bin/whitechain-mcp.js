#!/usr/bin/env node
// @ts-check
/**
 * whitechain-mcp            stdio MCP server (bridges to the hosted endpoint). Needs WC_SECRET_KEY.
 * whitechain-mcp init       adds Whitechain Commerce to the current repo's agent configs.
 * whitechain-mcp tools      prints the available tools.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { DEFAULT_BASE_URL, WhitechainAgentToolkit } from "../src/index.js";

const [cmd, ...rest] = process.argv.slice(2);

/** @param {string} name */
function flag(name) {
  const i = rest.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  const a = rest[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : (rest[i + 1] ?? "");
}

if (cmd === "init") init();
else if (cmd === "tools") await printTools();
else if (cmd === "--help" || cmd === "-h" || cmd === "help") help();
else if (cmd === undefined || cmd === "stdio") await stdio();
else {
  console.error(`Unknown command: ${cmd}\n`);
  help();
  process.exit(1);
}

function help() {
  console.log(`whitechain-mcp: Whitechain Commerce for AI agents

Usage
  npx @whitechain-commerce/mcp               Run the MCP server over stdio (set WC_SECRET_KEY)
  npx @whitechain-commerce/mcp init          Add Whitechain Commerce to this repo's agent configs
      --clients=claude,cursor,vscode,agents  Which files to write (default: all)
      --base-url=URL                         Dashboard URL (default: $WC_API_BASE or ${DEFAULT_BASE_URL})
      --dry-run                              Print what would change
  npx @whitechain-commerce/mcp tools         List the tools for your key

Environment
  WC_SECRET_KEY   Your secret key, sk_test_... (Dashboard > Developers)
  WC_API_BASE     Dashboard URL, if you self-host`);
}

/** Line-delimited JSON-RPC on stdin/stdout, forwarded to POST /api/mcp. Logs go to stderr only. */
async function stdio() {
  let toolkit;
  try {
    toolkit = new WhitechainAgentToolkit();
  } catch (e) {
    console.error(`[whitechain-mcp] ${(/** @type {Error} */ (e)).message}`);
    process.exit(1);
  }
  const write = (/** @type {unknown} */ msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  /** @type {Promise<void>[]} */
  const inflight = [];
  rl.on("line", (line) => {
    if (!line.trim()) return;
    /** @type {any} */
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    const p = toolkit
      .rpc(msg)
      .then((reply) => {
        if (reply !== null) write(reply);
      })
      .catch((e) => {
        console.error(`[whitechain-mcp] ${e.message}`);
        if (msg && msg.id !== undefined) write({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: `Could not reach Whitechain Commerce: ${e.message}` } });
      });
    inflight.push(p);
  });
  rl.on("close", async () => {
    await Promise.allSettled(inflight);
    process.exit(0);
  });
  console.error(`[whitechain-mcp] connected to ${toolkit.endpoint}`);
}

async function printTools() {
  const toolkit = new WhitechainAgentToolkit({ baseUrl: flag("base-url") });
  for (const t of await toolkit.listTools()) {
    const ro = t.annotations?.readOnlyHint ? " (read-only)" : "";
    console.log(`${t.name}${ro}\n  ${t.description}\n`);
  }
}

function init() {
  const base = (flag("base-url") || process.env.WC_API_BASE || DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = `${base}/api/mcp`;
  const clients = (flag("clients") || "claude,cursor,vscode,agents").split(",").map((s) => s.trim());
  const dry = rest.includes("--dry-run");
  const cwd = process.cwd();

  /** @param {string} file @param {(cur: any) => any} merge */
  const writeJson = (file, merge) => {
    const p = path.join(cwd, file);
    let cur = {};
    if (existsSync(p)) {
      try {
        cur = JSON.parse(readFileSync(p, "utf8"));
      } catch {
        console.error(`  skip ${file}: it is not plain JSON (comments?). Add the "whitechain" server by hand.`);
        return;
      }
    }
    const next = merge(cur);
    if (dry) return console.log(`  would write ${file}:\n${JSON.stringify(next, null, 2)}\n`);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`  wrote ${file}`);
  };

  console.log(`Adding Whitechain Commerce (${url})`);

  // Claude Code project config. ${VAR} is expanded by Claude Code at startup.
  if (clients.includes("claude"))
    writeJson(".mcp.json", (c) => ({
      ...c,
      mcpServers: { ...c.mcpServers, whitechain: { type: "http", url, headers: { Authorization: "Bearer ${WC_SECRET_KEY}" } } },
    }));

  if (clients.includes("cursor"))
    writeJson(".cursor/mcp.json", (c) => ({
      ...c,
      mcpServers: { ...c.mcpServers, whitechain: { url, headers: { Authorization: "Bearer ${env:WC_SECRET_KEY}" } } },
    }));

  // VS Code prompts for the key once and stores it in its secret storage.
  if (clients.includes("vscode"))
    writeJson(".vscode/mcp.json", (c) => ({
      ...c,
      inputs: [
        ...(c.inputs ?? []).filter((/** @type {{ id: string }} */ i) => i.id !== "whitechain-secret-key"),
        { type: "promptString", id: "whitechain-secret-key", description: "Whitechain Commerce secret key (sk_test_...)", password: true },
      ],
      servers: { ...c.servers, whitechain: { type: "http", url, headers: { Authorization: "Bearer ${input:whitechain-secret-key}" } } },
    }));

  if (clients.includes("agents")) {
    const p = path.join(cwd, "AGENTS.md");
    const cur = existsSync(p) ? readFileSync(p, "utf8") : "";
    if (cur.includes("<!-- whitechain-commerce -->")) console.log("  AGENTS.md already has the Whitechain section");
    else {
      const block = `${cur && !cur.endsWith("\n") ? "\n" : ""}${cur ? "\n" : ""}<!-- whitechain-commerce -->
## Payments: Whitechain Commerce

This project takes USDT payments with Whitechain Commerce (non-custodial, Whitechain Sepolia, chain 1874).

- Agents: use the \`whitechain\` MCP server (tools such as \`create_checkout_session\`, \`create_payment_link\`, \`list_payments\`, \`create_refund\`).
- Code: create checkout sessions server-side with \`POST ${base}/api/v1/checkout_sessions\` and \`Authorization: Bearer $WC_SECRET_KEY\`. Never expose the secret key to the browser.
- Verify webhook signatures with \`WC_WEBHOOK_SECRET\` before trusting a payment.
- Refunds created by an agent stay pending until the merchant signs them in the dashboard.
- Docs: ${base}/docs (plain text for LLMs: ${base}/docs/llms.txt)
<!-- /whitechain-commerce -->
`;
      if (dry) console.log(`  would append to AGENTS.md:\n${block}`);
      else {
        writeFileSync(p, cur + block);
        console.log("  updated AGENTS.md");
      }
    }
  }

  console.log(`
Next: put your secret key in the environment (Dashboard > Developers > Create key):
  export WC_SECRET_KEY=sk_test_...
Keep the key out of git; the config files only reference the variable.`);
}
