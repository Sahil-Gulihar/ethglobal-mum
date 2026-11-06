/**
 * A stateless Model Context Protocol server over Streamable HTTP (JSON responses, no SSE).
 * Every POST carries one JSON-RPC message or a batch; we answer with JSON. No session state is kept,
 * which suits serverless hosting. Auth is the merchant's secret API key.
 */
import "server-only";
import { merchantFromSecretKey } from "@/lib/api-auth";
import type { Merchant } from "@/lib/auth";
import { describeTool, ToolError, tools, toolsByName } from "./tools";
import { prompts } from "./prompts";

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "whitechain-commerce", title: "White Money", version: "1.0.0" };

const INSTRUCTIONS = `White Money is a non-custodial USDT checkout.
Use these tools to act for the merchant who owns this API key.
- To get paid, create a checkout session (one-off order) or a payment link (reusable fixed price) and share its url.
- Amounts are USDT decimal strings like "25.00".
- Funds go straight to the merchant's wallet. Refunds created here stay pending until the merchant signs them on the returned approveUrl; tell the user to open it.
- Call get_account first if you are unsure whether the account can take payments.`;

export const mcpCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate",
};

type Id = string | number | null;
type RpcMessage = { jsonrpc?: string; id?: Id; method?: string; params?: Record<string, unknown> };

const rpcResult = (id: Id, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: Id, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...mcpCorsHeaders, ...(body === null ? {} : { "Content-Type": "application/json" }), ...extra },
  });

async function dispatch(msg: RpcMessage, merchant: Merchant): Promise<object | null> {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined;
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return isNotification ? null : rpcError(id, -32600, "Invalid JSON-RPC request.");
  }
  if (isNotification) return null; // notifications/initialized, notifications/cancelled, ...

  switch (msg.method) {
    case "initialize": {
      const requested = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: `${INSTRUCTIONS}\nConnected merchant: ${merchant.name} (${merchant.id}).`,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: tools.map(describeTool) });
    case "tools/call": {
      const name = msg.params?.name;
      const t = typeof name === "string" ? toolsByName.get(name) : undefined;
      if (!t) return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
      const parsed = t.input.safeParse(msg.params?.arguments ?? {});
      if (!parsed.success) {
        const text = parsed.error.issues.map((i) => `${i.path.join(".") || "arguments"}: ${i.message}`).join("; ");
        return rpcResult(id, { content: [{ type: "text", text: `Invalid arguments. ${text}` }], isError: true });
      }
      try {
        const out = await t.run(merchant, parsed.data);
        if (typeof out === "string") return rpcResult(id, { content: [{ type: "text", text: out }] });
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
          structuredContent: out,
        });
      } catch (e) {
        if (e instanceof ToolError) return rpcResult(id, { content: [{ type: "text", text: e.message }], isError: true });
        console.error("[mcp]", t.name, e);
        return rpcResult(id, { content: [{ type: "text", text: "Internal error while running the tool." }], isError: true });
      }
    }
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: prompts.map(({ name, title, description, arguments: args }) => ({ name, title, description, arguments: args })) });
    case "prompts/get": {
      const p = prompts.find((x) => x.name === msg.params?.name);
      if (!p) return rpcError(id, -32602, `Unknown prompt: ${String(msg.params?.name)}`);
      const args = (msg.params?.arguments ?? {}) as Record<string, string>;
      return rpcResult(id, { description: p.description, messages: [{ role: "user", content: { type: "text", text: p.render(args, merchant) } }] });
    }
    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

/** Handles one Streamable HTTP POST. `key` is the secret key from the header or the connector URL. */
export async function handleMcpPost(req: Request, key: string | null): Promise<Response> {
  const merchant = key ? await merchantFromSecretKey(key) : null;
  if (!merchant) {
    return reply(rpcError(null, -32001, "Missing or invalid API key. Send `Authorization: Bearer sk_test_...` or use your connector URL."), 401, {
      "WWW-Authenticate": 'Bearer realm="whitechain-commerce"',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(rpcError(null, -32700, "Parse error: body must be JSON."), 400);
  }

  if (Array.isArray(body)) {
    if (!body.length) return reply(rpcError(null, -32600, "Empty batch."), 400);
    const out = (await Promise.all(body.map((m) => dispatch(m as RpcMessage, merchant)))).filter(Boolean);
    return out.length ? reply(out) : reply(null, 202);
  }
  const out = await dispatch(body as RpcMessage, merchant);
  return out ? reply(out) : reply(null, 202);
}

/** GET opens a server-to-client SSE stream in the spec; this stateless server doesn't offer one. */
export const mcpGet = () => reply(rpcError(null, -32000, "This server does not offer an SSE stream. POST JSON-RPC messages instead."), 405, { Allow: "POST, OPTIONS" });

export const mcpPreflight = () => reply(null, 204, { "Access-Control-Max-Age": "86400" });

export const bearerKey = (req: Request) => /^Bearer\s+(sk_test_[A-Za-z0-9]+)$/.exec((req.headers.get("authorization") ?? "").trim())?.[1] ?? null;
