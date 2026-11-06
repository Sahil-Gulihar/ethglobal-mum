// @ts-check
/**
 * Whitechain Commerce agent toolkit. Talks JSON-RPC to the hosted MCP endpoint (/api/mcp), so the
 * tool list always matches the server and nothing is duplicated here. Zero dependencies.
 */

export const DEFAULT_BASE_URL = "https://100lana.com";

/** @typedef {import("./index.d.ts").WhitechainTool} WhitechainTool */
/** @typedef {import("./index.d.ts").ToolkitOptions} ToolkitOptions */
/** @typedef {import("./index.d.ts").ToolResult} ToolResult */

export class WhitechainError extends Error {
  /** @param {string} message @param {number | undefined} [code] */
  constructor(message, code) {
    super(message);
    this.name = "WhitechainError";
    this.code = code;
  }
}

/** Reads WC_SECRET_KEY / WC_API_BASE when options are omitted. */
export function resolveOptions(/** @type {ToolkitOptions} */ opts = {}) {
  const env = typeof process !== "undefined" ? process.env : {};
  const secretKey = opts.secretKey ?? env.WC_SECRET_KEY ?? env.WHITECHAIN_SECRET_KEY;
  if (!secretKey) throw new WhitechainError("No secret key. Pass { secretKey } or set WC_SECRET_KEY (sk_test_...).");
  const baseUrl = (opts.baseUrl ?? env.WC_API_BASE ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  return { secretKey, baseUrl, fetch: opts.fetch ?? globalThis.fetch };
}

export class WhitechainAgentToolkit {
  /** @param {ToolkitOptions} [opts] */
  constructor(opts) {
    const o = resolveOptions(opts);
    this.secretKey = o.secretKey;
    this.baseUrl = o.baseUrl;
    this.endpoint = `${o.baseUrl}/api/mcp`;
    this._fetch = o.fetch;
    this._nextId = 1;
    /** @type {WhitechainTool[] | null} */
    this._tools = null;
  }

  /**
   * Sends raw JSON-RPC (one message or a batch) and returns the parsed reply, or null for 202.
   * @param {unknown} message
   */
  async rpc(message) {
    const res = await this._fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(message),
    });
    if (res.status === 202) return null;
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new WhitechainError(`Unexpected ${res.status} response from ${this.endpoint}: ${text.slice(0, 200)}`);
    }
  }

  /** @param {string} method @param {Record<string, unknown>} [params] */
  async request(method, params) {
    const reply = await this.rpc({ jsonrpc: "2.0", id: this._nextId++, method, params });
    if (reply?.error) throw new WhitechainError(reply.error.message, reply.error.code);
    return reply?.result;
  }

  /** The tools the server offers, with JSON Schema inputs. Cached after the first call. */
  async listTools() {
    if (!this._tools) this._tools = (await this.request("tools/list")).tools;
    return /** @type {WhitechainTool[]} */ (this._tools);
  }

  /**
   * Runs a tool. Returns { ok, data, text }; never throws for tool-level errors (bad amount etc.).
   * @param {string} name
   * @param {Record<string, unknown>} [args]
   * @returns {Promise<ToolResult>}
   */
  async callTool(name, args = {}) {
    const r = await this.request("tools/call", { name, arguments: args });
    const text = (r.content ?? []).map((/** @type {{ text?: string }} */ c) => c.text ?? "").join("\n");
    return { ok: !r.isError, data: r.structuredContent ?? null, text };
  }

  /** Tool definitions for the Anthropic Messages API (`tools` param). */
  async anthropicTools() {
    return (await this.listTools()).map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  }

  /** Tool definitions for OpenAI Chat Completions (`tools` param, type "function"). */
  async openAITools() {
    return (await this.listTools()).map((t) => ({
      type: /** @type {const} */ ("function"),
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }

  /**
   * Tools for the Vercel AI SDK. Pass the `jsonSchema` helper from "ai" so this package stays dependency-free:
   * `const tools = await toolkit.aiSdkTools(jsonSchema)`.
   * @param {(schema: object) => unknown} jsonSchema
   */
  async aiSdkTools(jsonSchema) {
    /** @type {Record<string, { description: string; inputSchema: unknown; execute: (args: any) => Promise<unknown> }>} */
    const out = {};
    for (const t of await this.listTools()) {
      out[t.name] = {
        description: t.description,
        inputSchema: jsonSchema(t.inputSchema),
        execute: async (args) => {
          const r = await this.callTool(t.name, args);
          return r.ok ? r.data ?? r.text : { error: r.text };
        },
      };
    }
    return out;
  }

  /**
   * Runs an Anthropic `tool_use` block and returns the matching `tool_result` block.
   * @param {{ id: string; name: string; input: unknown }} block
   */
  async handleAnthropicToolUse(block) {
    const r = await this.callTool(block.name, /** @type {Record<string, unknown>} */ (block.input ?? {}));
    return { type: /** @type {const} */ ("tool_result"), tool_use_id: block.id, content: r.text, is_error: !r.ok };
  }

  /**
   * Runs an OpenAI tool call and returns the `role: "tool"` message to append.
   * @param {{ id: string; function: { name: string; arguments: string } }} call
   */
  async handleOpenAIToolCall(call) {
    const r = await this.callTool(call.function.name, JSON.parse(call.function.arguments || "{}"));
    return { role: /** @type {const} */ ("tool"), tool_call_id: call.id, content: r.text };
  }
}

// ---------------------------------------------------------------------------------------------
// Connect with approval: the agent makes its own key, sends only its hash, and a human approves.

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** @returns {Crypto} */
function webcrypto() {
  const c = globalThis.crypto;
  if (!c?.getRandomValues || !c.subtle) throw new WhitechainError("Web Crypto is not available in this runtime (needs Node 18+ or an edge runtime).");
  return c;
}

/** Crypto-strong base62 string, with rejection sampling so every character is equally likely. */
function randomBase62(/** @type {number} */ len) {
  const c = webcrypto();
  let out = "";
  while (out.length < len) {
    const buf = c.getRandomValues(new Uint8Array(len * 2));
    for (const b of buf) {
      if (b < 248) out += BASE62[b % 62]; // 248 = 62 * 4
      if (out.length === len) break;
    }
  }
  return out;
}

/** sha256 of a UTF-8 string, as lowercase hex. */
export async function sha256Hex(/** @type {string} */ s) {
  const digest = await webcrypto().subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Code shown to the human on both sides: first 8 hex of sha256("wc-connect:" + hash), as XXXX-XXXX. */
export async function connectCode(/** @type {string} */ hash) {
  const hex = (await sha256Hex(`wc-connect:${hash}`)).slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** @param {number} ms @param {AbortSignal | undefined} signal */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new WhitechainError("Aborted"));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(undefined);
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal?.reason ?? new WhitechainError("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Starts an approval-based connection. Generates a secret key locally, builds the approval URL from
 * its sha256 (the key itself is never sent), and returns a waiter that resolves once a human approves.
 * @param {import("./index.d.ts").StartConnectOptions} [opts]
 * @returns {Promise<import("./index.d.ts").ConnectRequest>}
 */
export async function startConnect(opts = {}) {
  const env = typeof process !== "undefined" ? process.env : {};
  const baseUrl = (opts.baseUrl ?? env.WC_API_BASE ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const clientName = (opts.clientName ?? "AI agent").trim().slice(0, 60) || "AI agent";
  const secretKey = `sk_test_${randomBase62(32)}`;
  const hash = await sha256Hex(secretKey);
  const prefix = secretKey.slice(0, 12);
  const code = await connectCode(hash);
  const approveUrl = `${baseUrl}/connect?h=${hash}&p=${prefix}&n=${encodeURIComponent(clientName)}`;

  /** @param {import("./index.d.ts").WaitForApprovalOptions} [w] */
  async function waitForApproval(w = {}) {
    const timeoutMs = w.timeoutMs ?? 10 * 60_000;
    const intervalMs = w.intervalMs ?? 2_000;
    const toolkit = new WhitechainAgentToolkit({ secretKey, baseUrl, fetch: opts.fetch });
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (w.signal?.aborted) throw w.signal.reason ?? new WhitechainError("Aborted");
      try {
        const r = await toolkit.callTool("get_account");
        if (!r.ok) throw new WhitechainError(r.text || "get_account failed");
        return r.data;
      } catch (e) {
        // -32001 is the server's "invalid API key" (HTTP 401): not approved yet. Network errors are retried too.
        const pendingApproval = e instanceof WhitechainError && e.code === -32001;
        const network = e instanceof TypeError;
        if (!pendingApproval && !network) throw e;
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new WhitechainError(`Not approved within ${Math.round(timeoutMs / 1000)}s. Run login again to get a new link.`);
      await sleep(Math.min(intervalMs, left), w.signal);
    }
  }

  return { secretKey, approveUrl, code, waitForApproval };
}
