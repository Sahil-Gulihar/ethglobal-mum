/**
 * Minimal client for the 0G Private Computer router (OpenAI-compatible, https://router-api.0g.ai/v1).
 *
 * Every inference call returns the router's request ID (the `X-Request-ID` header, also
 * `x_0g_trace.request_id` in the body), which we store per human check so each 0G call can be traced
 * in the buyer's 0G usage history.
 *
 * Inference uses an `sk-` key: the platform key for guests, or the key minted for a signed-in buyer.
 * Account reads and key minting use the buyer's own `mk-` management key.
 */
import "server-only";
import { env } from "@/lib/env";

export class ZgError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly requestId: string | null,
  ) {
    super(message);
  }
}

export type ZgResult<T> = { data: T; requestId: string | null; model: string };

type Body = Record<string, unknown>;

async function call<T>(path: string, key: string, init: { method?: string; body?: Body | FormData; trust?: boolean; timeoutMs?: number }): Promise<{ data: T; requestId: string | null }> {
  const cfg = env.zg();
  const headers: Record<string, string> = { authorization: `Bearer ${key}` };
  if (init.body && !(init.body instanceof FormData)) headers["content-type"] = "application/json";
  if (init.trust && cfg.trustMode) headers["x-0g-provider-trust-mode"] = cfg.trustMode;
  headers["x-client-request-id"] = `whitechain-${crypto.randomUUID()}`;
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers,
    body: init.body instanceof FormData ? init.body : init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(init.timeoutMs ?? 90_000),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  const j = (json ?? {}) as { error?: { message?: string; code?: string }; request_id?: string; x_0g_trace?: { request_id?: string } };
  const requestId = res.headers.get("x-request-id")?.split(",").pop()?.trim() || j.x_0g_trace?.request_id || j.request_id || null;
  if (!res.ok) {
    throw new ZgError(j.error?.message || `0G router returned HTTP ${res.status}`, res.status, j.error?.code ?? null, requestId);
  }
  return { data: json as T, requestId: j.x_0g_trace?.request_id || requestId };
}

/** Text-to-image. Returns a data: URL. Falls back to the async job API if the model answers with a job. */
export async function generateImage(key: string, prompt: string): Promise<ZgResult<{ dataUrl: string }>> {
  const model = env.zg().imageModel;
  type Img = { data?: { b64_json?: string; url?: string }[]; jobId?: string; job_id?: string; id?: string; provider_address?: string; status?: string };
  const r = await call<Img>("/images/generations", key, {
    body: { model, prompt, n: 1, size: "1024x1024", response_format: "b64_json" },
    trust: true,
    timeoutMs: 120_000,
  });
  let img = r.data;
  let requestId = r.requestId;
  const jobId = img.jobId ?? img.job_id;
  if (!img.data?.length && jobId) {
    const deadline = Date.now() + 110_000;
    const qs = img.provider_address ? `?provider_address=${encodeURIComponent(img.provider_address)}` : "";
    while (Date.now() < deadline) {
      await new Promise((ok) => setTimeout(ok, 1500));
      const poll = await call<Img>(`/async/jobs/${encodeURIComponent(jobId)}${qs}`, key, { trust: true });
      if (poll.data.data?.length) {
        img = poll.data;
        requestId = poll.requestId ?? requestId;
        break;
      }
      if (poll.data.status === "failed") throw new ZgError("0G image job failed", 502, "job_failed", poll.requestId);
    }
  }
  const first = img.data?.[0];
  if (!first) throw new ZgError("0G returned no image", 502, "no_image", requestId);
  const dataUrl = first.b64_json ? `data:image/png;base64,${first.b64_json}` : first.url!;
  return { data: { dataUrl }, requestId, model };
}

/** Chat completion on 0G (TEE). Returns the assistant text. */
export async function chat(key: string, messages: { role: "system" | "user"; content: string }[], maxTokens = 1200): Promise<ZgResult<{ text: string }>> {
  const model = env.zg().judgeModel;
  type Chat = { choices?: { message?: { content?: string | null } }[] };
  const r = await call<Chat>("/chat/completions", key, {
    body: { model, messages, max_tokens: maxTokens, temperature: 0, reasoning_effort: "low" },
    trust: true,
  });
  return { data: { text: r.data.choices?.[0]?.message?.content ?? "" }, requestId: r.requestId, model };
}

/** Speech-to-text with Whisper on 0G (TEE). */
export async function transcribe(key: string, audio: Blob, filename: string): Promise<ZgResult<{ text: string }>> {
  const model = env.zg().asrModel;
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", model);
  form.append("language", "en");
  const r = await call<{ text?: string }>("/audio/transcriptions", key, { body: form, trust: true });
  return { data: { text: (r.data.text ?? "").trim() }, requestId: r.requestId, model };
}

export type ZgBalance = { address: string; currency: string; total: string; credit: string; deposit: string };

/** Router ledger balance for a management key with account:read. Amounts are raw strings from the router. */
export async function getBalance(mgmtKey: string): Promise<ZgBalance> {
  const r = await call<{ address?: string; currency?: string; total_balance?: string; balance?: string; credit_balance?: string; deposit_balance?: string }>(
    "/account/balance",
    mgmtKey,
    { timeoutMs: 15_000 },
  );
  const d = r.data;
  return {
    address: (d.address ?? "").toLowerCase(),
    currency: d.currency ?? "0g",
    total: d.total_balance ?? d.balance ?? "0",
    credit: d.credit_balance ?? "0",
    deposit: d.deposit_balance ?? "0",
  };
}

/** Mints a capped inference key on the buyer's own account (needs keys:create). Only these three models, daily reset. */
export async function mintInferenceKey(mgmtKey: string, dailyLimit: string): Promise<{ key: string; keyId: string }> {
  const cfg = env.zg();
  const r = await call<{ key?: string; key_id?: string }>("/api-keys", mgmtKey, {
    body: {
      name: `Whitechain verified buyer ${new Date().toISOString().slice(0, 10)}`,
      expiration: "no_expiration",
      credit_limit: dailyLimit,
      reset_period: "daily",
      trust_mode: cfg.trustMode || "",
      allowed_models: [cfg.imageModel, cfg.judgeModel, cfg.asrModel],
    },
    timeoutMs: 15_000,
  });
  if (!r.data.key || !r.data.key_id) throw new ZgError("0G didn't return the new API key", 502, "no_key", r.requestId);
  return { key: r.data.key, keyId: r.data.key_id };
}

export async function revokeInferenceKey(mgmtKey: string, keyId: string): Promise<void> {
  await call(`/api-keys/${encodeURIComponent(keyId)}`, mgmtKey, { method: "DELETE", timeoutMs: 15_000 }).catch(() => undefined);
}

export { formatZgAmount } from "./format";
