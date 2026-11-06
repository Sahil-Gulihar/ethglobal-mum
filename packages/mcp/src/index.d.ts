export declare const DEFAULT_BASE_URL: string;

export interface ToolkitOptions {
  /** Secret API key (sk_test_...). Defaults to process.env.WC_SECRET_KEY. */
  secretKey?: string;
  /** Dashboard URL. Defaults to process.env.WC_API_BASE, then the hosted dashboard. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface WhitechainTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[]; [k: string]: unknown };
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

export interface ToolResult<T = any> {
  /** false when the tool reported an error (for example an invalid amount). */
  ok: boolean;
  /** Structured JSON result, or null on error. */
  data: T | null;
  /** The same result as text, or the error message. */
  text: string;
}

export declare class WhitechainError extends Error {
  code?: number;
  constructor(message: string, code?: number);
}

export declare function resolveOptions(opts?: ToolkitOptions): { secretKey: string; baseUrl: string; fetch: typeof fetch };

export declare class WhitechainAgentToolkit {
  readonly secretKey: string;
  readonly baseUrl: string;
  readonly endpoint: string;
  constructor(opts?: ToolkitOptions);
  rpc(message: unknown): Promise<any>;
  request(method: string, params?: Record<string, unknown>): Promise<any>;
  listTools(): Promise<WhitechainTool[]>;
  callTool<T = any>(name: string, args?: Record<string, unknown>): Promise<ToolResult<T>>;
  anthropicTools(): Promise<{ name: string; description: string; input_schema: WhitechainTool["inputSchema"] }[]>;
  openAITools(): Promise<{ type: "function"; function: { name: string; description: string; parameters: WhitechainTool["inputSchema"] } }[]>;
  aiSdkTools<S>(jsonSchema: (schema: object) => S): Promise<Record<string, { description: string; inputSchema: S; execute: (args: any) => Promise<unknown> }>>;
  handleAnthropicToolUse(block: { id: string; name: string; input: unknown }): Promise<{ type: "tool_result"; tool_use_id: string; content: string; is_error: boolean }>;
  handleOpenAIToolCall(call: { id: string; function: { name: string; arguments: string } }): Promise<{ role: "tool"; tool_call_id: string; content: string }>;
}

export interface StartConnectOptions {
  /** Dashboard URL. Defaults to process.env.WC_API_BASE, then the hosted dashboard. */
  baseUrl?: string;
  /** Shown to the human on the approval page (1-60 chars). Defaults to "AI agent". */
  clientName?: string;
  fetch?: typeof fetch;
}

export interface WaitForApprovalOptions {
  /** Give up after this long. Default 10 minutes. */
  timeoutMs?: number;
  /** Time between polls. Default 2 seconds. */
  intervalMs?: number;
  signal?: AbortSignal;
}

export interface ConnectRequest {
  /** The new key, generated locally. Store it (for example as WC_SECRET_KEY); it is never sent anywhere until approved. */
  secretKey: string;
  /** Open this in a browser where the merchant is logged in. Contains only the key's sha256 and prefix. */
  approveUrl: string;
  /** XXXX-XXXX code the human matches against the approval page. */
  code: string;
  /** Polls get_account until the key works, then resolves with the account. Rejects on timeout or abort. */
  waitForApproval(opts?: WaitForApprovalOptions): Promise<any>;
}

export declare function startConnect(opts?: StartConnectOptions): Promise<ConnectRequest>;
export declare function connectCode(hash: string): Promise<string>;
export declare function sha256Hex(s: string): Promise<string>;
