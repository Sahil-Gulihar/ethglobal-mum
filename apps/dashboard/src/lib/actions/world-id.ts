"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { IDKitResult } from "@worldcoin/idkit-core";
import { db, merchants } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { signWorldIdRequest, verifyWorldIdProof, worldIdConfig, type WorldIdRequest } from "@/lib/world-id";
import { err, ok, type ActionResult } from "./result";

export type { WorldIdRequest };

/** Signs a fresh RP request (5 min TTL) so the browser can open IDKit. The signal binds the proof to this merchant. */
export async function startWorldIdVerification(): Promise<ActionResult<WorldIdRequest>> {
  const m = await requireMerchant();
  if (m.status === "active" && m.worldNullifier) return err("Your account is already verified.");
  const cfg = worldIdConfig();
  if (!cfg) return err("World ID isn't configured on this server.");
  return ok(signWorldIdRequest(cfg, cfg.action, m.id));
}

/**
 * Verifies the IDKit result with the World Developer Portal, then stores the nullifier
 * and activates the merchant. The unique nullifier column enforces one human, one account.
 */
export async function completeWorldIdVerification(result: IDKitResult): Promise<ActionResult<{ status: "active" }>> {
  const m = await requireMerchant();
  if (m.status === "active" && m.worldNullifier) return ok({ status: "active" });
  const cfg = worldIdConfig();
  if (!cfg) return err("World ID isn't configured on this server.");

  const proof = await verifyWorldIdProof(cfg, cfg.action, m.id, result);
  if (!proof.ok) return err(proof.error);
  const nullifier = proof.nullifier;

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

function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur === "object" && cur !== null && "code" in cur && (cur as { code?: string }).code === "23505") return true;
    cur = typeof cur === "object" && cur !== null && "cause" in cur ? (cur as { cause?: unknown }).cause : undefined;
  }
  return false;
}
