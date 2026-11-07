import type { ApiError, PublicCheckoutSession } from "@whitechain-commerce/core";
import type { RpContext } from "@worldcoin/idkit";

/** Error from the Whitechain Commerce HTTP API. */
export class WhitechainApiError extends Error {
  readonly status: number;
  readonly type: ApiError["error"]["type"] | "network_error";
  constructor(message: string, status: number, type: WhitechainApiError["type"]) {
    super(message);
    this.name = "WhitechainApiError";
    this.status = status;
    this.type = type;
  }
}

export function resolveApiBase(apiBase?: string): string {
  const env = (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_WC_API_BASE) || "";
  return (apiBase ?? env ?? "").replace(/\/+$/, "");
}

/** fetch + JSON with readable errors. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    if (init?.body) headers["Content-Type"] = "application/json";
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    throw new WhitechainApiError(
      `Could not reach Whitechain Commerce at ${url} (${(e as Error)?.message ?? "network error"})`,
      0,
      "network_error",
    );
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const err = (body as ApiError | null)?.error;
    throw new WhitechainApiError(
      err?.message ?? `Whitechain Commerce API returned HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      res.status,
      err?.type ?? "server_error",
    );
  }
  return body as T;
}

export const getSession = (apiBase: string, id: string, signal?: AbortSignal) =>
  apiFetch<PublicCheckoutSession>(`${apiBase}/api/v1/checkout_sessions/${encodeURIComponent(id)}`, {
    cache: "no-store",
    signal,
  });

export const submitTx = (apiBase: string, id: string, txHash: string) =>
  apiFetch<{ ok: true; status: PublicCheckoutSession["status"] }>(`${apiBase}/api/v1/checkout_sessions/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    body: JSON.stringify({ txHash }),
  });

/** Verified buyers (World ID): what the browser needs to open IDKit for this checkout. */
export type WorldIdStart =
  | { verified: true }
  | {
      verified: false;
      appId: `app_${string}`;
      action: string;
      environment: "production" | "staging";
      signal: string;
      rpContext: RpContext;
    };

export const startWorldId = (apiBase: string, id: string) =>
  apiFetch<WorldIdStart>(`${apiBase}/api/v1/checkout_sessions/${encodeURIComponent(id)}/world_id`, { method: "POST", cache: "no-store" });

export const verifyWorldId = (apiBase: string, id: string, result: unknown) =>
  apiFetch<{ verified: true }>(`${apiBase}/api/v1/checkout_sessions/${encodeURIComponent(id)}/world_id/verify`, {
    method: "POST",
    body: JSON.stringify(result),
  });
