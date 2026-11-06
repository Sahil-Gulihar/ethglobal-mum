// @ts-check
/**
 * Whitechain Commerce agent toolkit. Talks JSON-RPC to the hosted MCP endpoint (/api/mcp), so the
 * tool list always matches the server and nothing is duplicated here. Zero dependencies.
 */

export const DEFAULT_BASE_URL = "https://whitechain-dashboard.vercel.app";

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
