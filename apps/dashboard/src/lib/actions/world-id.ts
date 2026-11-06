"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { signRequest } from "@worldcoin/idkit-core/signing";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import type { IDKitResult, RpContext } from "@worldcoin/idkit-core";
import { db, merchants } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { env } from "@/lib/env";
import { err, ok, type ActionResult } from "./result";

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

/** Signs a fresh RP request (5 min TTL) so the browser can open IDKit. The signal binds the proof to this merchant. */
export async function startWorldIdVerification(): Promise<ActionResult<WorldIdRequest>> {
  const m = await requireMerchant();
  if (m.status === "active" && m.worldNullifier) return err("Your account is already verified.");
  let cfg: ReturnType<typeof env.worldId>;
  try {
    cfg = env.worldId();
  } catch (e) {
    console.error("World ID is not configured", e);
    return err("World ID isn't configured on this server.");
  }
  const sig = signRequest({ signingKeyHex: cfg.signingKey, action: cfg.action, ttl: 300 });
  return ok({
    appId: cfg.appId,
    action: cfg.action,
    environment: cfg.environment,
    signal: m.id,
    rpContext: { rp_id: cfg.rpId, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
  });
}

/**
 * Verifies the IDKit result with the World Developer Portal, then stores the nullifier
 * and activates the merchant. The unique nullifier column enforces one human, one account.
 */
export async function completeWorldIdVerification(result: IDKitResult): Promise<ActionResult<{ status: "active" }>> {
  const m = await requireMerchant();
  if (m.status === "active" && m.worldNullifier) return ok({ status: "active" });
  const cfg = env.worldId();

  if (!result || typeof result !== "object" || !Array.isArray(result.responses) || result.responses.length === 0) {
    return reject("empty_proof", result, "World ID returned an empty proof. Try again.");
  }
  // Legacy (v3) results may omit `action`; the signed RP request and the Developer Portal still bind it.
  if ("action" in result && result.action && result.action !== cfg.action) {
    return reject("action_mismatch", result, "This proof is for a different action.");
  }
  if (result.environment && result.environment !== cfg.environment) {
    return reject(
      "environment_mismatch",
      result,
      `This proof came from World ID ${result.environment}, but the server expects ${cfg.environment}.`,
    );
  }
  // Compare as field elements: hex padding and case differ between proof versions.
  const expectedSignal = toBigInt(hashSignal(m.id));
  for (const r of result.responses) {
    const sh = "signal_hash" in r ? toBigInt(r.signal_hash) : null;
    if (sh === null || sh !== expectedSignal) {
      return reject("signal_mismatch", result, "This proof was made for a different account.", {
        expected: hashSignal(m.id),
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
      return err(`World ID couldn't verify this proof${why ? ` (${why})` : ""}.`);
    }
  } catch (e) {
    console.error("World ID verify failed", e);
    return err("We couldn't reach World ID. Try again.");
  }

  const raw =
    body.results?.find((r) => r.success && r.nullifier)?.nullifier ??
    body.nullifier ??
    (result.responses as { nullifier?: string }[]).find((r) => r.nullifier)?.nullifier;
  if (!raw) return err("World ID didn't return a nullifier. Try again.");
  let nullifier: string;
  try {
    // v4 nullifiers are decimal, legacy v3 ones are hex. Store one canonical decimal form.
    nullifier = BigInt(raw).toString(10);
  } catch {
    return err("World ID returned an invalid nullifier.");
  }

  const DUPLICATE = "This World ID is already linked to another merchant account. One person, one account.";
  const [taken] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.worldNullifier, nullifier)).limit(1);
  // Staging (simulator) identities are shared by everyone, so one-account-per-human is only enforced in production.
  // A reused staging identity stores a per-merchant marker (unique, so the column constraint holds; still truthy for the UI).
  const sharedTestIdentity = taken && taken.id !== m.id && cfg.environment === "staging";
  if (taken && taken.id !== m.id && !sharedTestIdentity) {
    console.warn("World ID proof refused", { reason: "duplicate_nullifier", merchant: m.id, linkedTo: taken.id });
    return err(DUPLICATE);
  }
  if (sharedTestIdentity) console.info("World ID staging identity reused", { merchant: m.id, linkedTo: taken.id });

  try {
    await db
      .update(merchants)
      .set({ status: "active", worldNullifier: sharedTestIdentity ? `staging:${nullifier}:${m.id}` : nullifier })
      .where(eq(merchants.id, m.id));
  } catch (e) {
    if (isUniqueViolation(e)) {
      console.warn("World ID proof refused", { reason: "duplicate_nullifier_race", merchant: m.id });
      return err(DUPLICATE);
    }
    throw e;
  }
  revalidatePath("/dashboard", "layout");
  return ok({ status: "active" });
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
function reject(reason: string, result: IDKitResult | null | undefined, message: string, extra?: Record<string, unknown>) {
  const r = (result ?? {}) as Partial<IDKitResult> & { protocol_version?: string; action?: string; environment?: string };
  console.warn("World ID proof refused", {
    reason,
    protocol_version: r.protocol_version,
    action: r.action,
    environment: r.environment,
    identifiers: Array.isArray(r.responses) ? r.responses.map((x) => x.identifier) : undefined,
    ...extra,
  });
  return err(message);
}

function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur === "object" && cur !== null && "code" in cur && (cur as { code?: string }).code === "23505") return true;
    cur = typeof cur === "object" && cur !== null && "cause" in cur ? (cur as { cause?: unknown }).cause : undefined;
  }
  return false;
}
