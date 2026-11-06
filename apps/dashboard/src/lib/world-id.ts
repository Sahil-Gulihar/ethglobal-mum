import "server-only";

import { signRequest } from "@worldcoin/idkit-core/signing";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import type { IDKitResult, RpContext } from "@worldcoin/idkit-core";
import { env } from "@/lib/env";

export type WorldIdConfig = ReturnType<typeof env.worldId>;

/** What the browser needs to open IDKit. Shared by merchant onboarding and verified-buyer checks. */
export type WorldIdRequest = {
  appId: `app_${string}`;
  action: string;
  environment: "production" | "staging";
  signal: string;
  rpContext: RpContext;
};

type VerifyResponse = {
  success?: boolean;
  code?: string;
  detail?: string;
  environment?: string;
  nullifier?: string;
  results?: { identifier?: string; success?: boolean; nullifier?: string; code?: string; detail?: string }[];
};

/** Returns the config, or null when World ID env vars are missing (logged). */
export function worldIdConfig(): WorldIdConfig | null {
  try {
    return env.worldId();
  } catch (e) {
    console.error("World ID is not configured", e);
    return null;
  }
}

/** Signs a fresh RP request (5 min TTL). The signal binds the proof to one account or checkout. */
export function signWorldIdRequest(cfg: WorldIdConfig, action: string, signal: string): WorldIdRequest {
  const sig = signRequest({ signingKeyHex: cfg.signingKey, action, ttl: 300 });
  return {
    appId: cfg.appId,
    action,
    environment: cfg.environment,
    signal,
    rpContext: { rp_id: cfg.rpId, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
  };
}

export type ProofCheck = { ok: true; nullifier: string } | { ok: false; error: string };

/**
 * Checks the IDKit result locally (action, environment, signal), verifies it with the World Developer Portal,
 * and returns the nullifier in one canonical decimal form.
 */
export async function verifyWorldIdProof(cfg: WorldIdConfig, action: string, signal: string, result: IDKitResult): Promise<ProofCheck> {
  if (!result || typeof result !== "object" || !Array.isArray(result.responses) || result.responses.length === 0) {
    return reject("empty_proof", result, "World ID returned an empty proof. Try again.");
  }
  // Legacy (v3) results may omit `action`; the signed RP request and the Developer Portal still bind it.
  if ("action" in result && result.action && result.action !== action) {
    return reject("action_mismatch", result, "This proof is for a different action.");
  }
  if (result.environment && result.environment !== cfg.environment) {
    return reject("environment_mismatch", result, `This proof came from World ID ${result.environment}, but the server expects ${cfg.environment}.`);
  }
  // Compare as field elements: hex padding and case differ between proof versions.
  const expectedSignal = toBigInt(hashSignal(signal));
  for (const r of result.responses) {
    const sh = "signal_hash" in r ? toBigInt(r.signal_hash) : null;
    if (sh === null || sh !== expectedSignal) {
      return reject("signal_mismatch", result, "This proof was made for something else. Start again.", {
        expected: hashSignal(signal),
        got: "signal_hash" in r ? r.signal_hash : undefined,
      });
    }
  }

  let body: VerifyResponse;
  try {
    const res = await fetch(`https://developer.world.org/api/v4/verify/${cfg.rpId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...result, environment: cfg.environment }),
      cache: "no-store",
    });
    body = (await res.json().catch(() => ({}))) as VerifyResponse;
    if (!res.ok || body.success !== true) {
      console.warn("World ID verify rejected", res.status, body);
      const why = body.results?.find((r) => r.detail)?.detail ?? body.detail ?? body.code;
      return { ok: false, error: `World ID couldn't verify this proof${why ? ` (${why})` : ""}.` };
    }
  } catch (e) {
    console.error("World ID verify failed", e);
    return { ok: false, error: "We couldn't reach World ID. Try again." };
  }

  const raw =
    body.results?.find((r) => r.success && r.nullifier)?.nullifier ??
    body.nullifier ??
    (result.responses as { nullifier?: string }[]).find((r) => r.nullifier)?.nullifier;
  if (!raw) return { ok: false, error: "World ID didn't return a nullifier. Try again." };
  try {
    // v4 nullifiers are decimal, legacy v3 ones are hex. Store one canonical decimal form.
    return { ok: true, nullifier: BigInt(raw).toString(10) };
  } catch {
    return { ok: false, error: "World ID returned an invalid nullifier." };
  }
}

function toBigInt(v: unknown): bigint | null {
  if (typeof v !== "string" || v === "") return null;
  try {
    return BigInt(v);
  } catch {
    return null;
  }
}

/** Logs why a proof was refused (Vercel logs), then returns the user-facing error. */
function reject(reason: string, result: IDKitResult | null | undefined, message: string, extra?: Record<string, unknown>): ProofCheck {
  const r = (result ?? {}) as Partial<IDKitResult> & { protocol_version?: string; action?: string; environment?: string };
  console.warn("World ID proof refused", {
    reason,
    protocol_version: r.protocol_version,
    action: r.action,
    environment: r.environment,
    identifiers: Array.isArray(r.responses) ? r.responses.map((x) => x.identifier) : undefined,
    ...extra,
  });
  return { ok: false, error: message };
}
