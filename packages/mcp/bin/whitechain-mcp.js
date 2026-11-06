#!/usr/bin/env node
// @ts-check
/**
 * whitechain-mcp            stdio MCP server (bridges to the hosted endpoint). Needs WC_SECRET_KEY.
 * whitechain-mcp init       adds Whitechain Commerce to the current repo's agent configs.
 * whitechain-mcp tools      prints the available tools.
 * whitechain-mcp login      connects a new key with the merchant's approval in the browser.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { DEFAULT_BASE_URL, WhitechainAgentToolkit, startConnect } from "../src/index.js";

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
else if (cmd === "login") await login();
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
  npx @whitechain-commerce/mcp login         Get a key by approving this agent in the browser (no copy-paste)
      --name="My agent"                      Name shown on the approval page and under Developers
      --base-url=URL                         Dashboard URL (default: $WC_API_BASE or ${DEFAULT_BASE_URL})
      --save=.env.local                      Write WC_SECRET_KEY=... to this file once approved
      --print-key                            Print the full key once approved
      --timeout=600                          Seconds to wait for approval (default: 600)

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

- Agents: use the \`whitechain\` MCP server. It can do everything the dashboard does except identity, payout wallet, refund signing and keys (those come back as \`humanActions\` links for the user). Confirm payments with \`wait_for_payment\`, never by trusting the client.
- Integrating or changing payment code: first read ${base}/integrate.md (or call the \`get_integration_guide\` tool) and follow it.
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
Keep the key out of git; the config files only reference the variable.

No key yet? Run npx @whitechain-commerce/mcp login`);
}

/** Replaces or appends KEY=value in a dotenv file, keeping every other line. */
function saveEnv(/** @type {string} */ file, /** @type {string} */ name, /** @type {string} */ value) {
  const p = path.resolve(process.cwd(), file);
  const cur = existsSync(p) ? readFileSync(p, "utf8") : "";
  const line = `${name}=${value}`;
  const re = new RegExp(`^${name}=.*$`, "m");
  const next = re.test(cur) ? cur.replace(re, () => line) : `${cur}${cur && !cur.endsWith("\n") ? "\n" : ""}${line}\n`;
  writeFileSync(p, next, { mode: 0o600 });
  return p;
}

async function login() {
  const save = flag("save");
  const printKey = rest.includes("--print-key");
  if (!save && !printKey) {
    // Approving a key nobody keeps would leave an orphan key on the account.
    console.error("Pass --save=.env.local (recommended) or --print-key so the new key isn't lost after you approve it.");
    process.exit(1);
  }
  const timeoutS = Number(flag("timeout") || 600);
  const name = flag("name") || `whitechain-mcp on ${os.hostname()}`.slice(0, 60);
  const c = await startConnect({ baseUrl: flag("base-url") || undefined, clientName: name });

  console.log(`To connect "${name}" to your Whitechain Commerce account, open this link and approve:

  ${c.approveUrl}

Confirmation code: ${c.code}
Check that the page shows the same code. Waiting for approval...`);

  const ac = new AbortController();
  process.once("SIGINT", () => ac.abort(new Error("Cancelled.")));
  /** @type {any} */
  let account;
  try {
    account = await c.waitForApproval({ timeoutMs: (Number.isFinite(timeoutS) && timeoutS > 0 ? timeoutS : 600) * 1000, signal: ac.signal });
  } catch (e) {
    console.error(`\n${(/** @type {Error} */ (e)).message}`);
    process.exit(1);
  }
  console.log(`\nConnected as ${account?.businessName ?? "your account"}`);
  if (save) console.log(`Saved WC_SECRET_KEY (${c.secretKey.slice(0, 12)}...) to ${saveEnv(save, "WC_SECRET_KEY", c.secretKey)}`);
  if (printKey) console.log(`WC_SECRET_KEY=${c.secretKey}`);
  console.log("Revoke it anytime in the dashboard under Developers.");
}
