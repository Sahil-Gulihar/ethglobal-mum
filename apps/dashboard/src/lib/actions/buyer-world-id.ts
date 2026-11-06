"use server";

import { and, eq, isNull } from "drizzle-orm";
import type { IDKitResult } from "@worldcoin/idkit-core";
import { checkoutSessions, db, merchants } from "@/lib/db";
import { signWorldIdRequest, verifyWorldIdProof, worldIdConfig, type WorldIdRequest } from "@/lib/world-id";
import { err, ok, type ActionResult } from "./result";

/**
 * Verified buyers with World ID. Public (no merchant login): anyone holding the checkout link can run it.
 * The proof's signal is the checkout session ID, so a proof only unlocks the checkout it was made for.
 */

async function openSession(sessionId: string) {
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9]+$/.test(sessionId)) return null;
  const [row] = await db
    .select({ s: checkoutSessions, method: merchants.verifiedBuyerMethod })
    .from(checkoutSessions)
    .innerJoin(merchants, eq(merchants.id, checkoutSessions.merchantId))
    .where(eq(checkoutSessions.id, sessionId))
    .limit(1);
  if (!row || row.s.status !== "open" || row.s.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export type BuyerWorldIdStart = { verified: true } | ({ verified: false } & WorldIdRequest);

/** Signs a World ID request bound to this checkout. Returns `verified: true` if the buyer already passed. */
export async function startBuyerWorldId(sessionId: string): Promise<ActionResult<BuyerWorldIdStart>> {
  const row = await openSession(sessionId);
  if (!row) return err("This checkout is no longer open.");
  if (row.s.humanVerifiedAt) return ok({ verified: true });
  if (row.method !== "world_id") return err("This store doesn't use World ID for buyer checks.");
  const cfg = worldIdConfig();
  if (!cfg) return err("World ID isn't configured on this server.");
  return ok({ verified: false, ...signWorldIdRequest(cfg, cfg.buyerAction, sessionId) });
}

/** Verifies the proof with World, then marks the checkout as paid-for by a verified human. */
export async function completeBuyerWorldId(sessionId: string, result: IDKitResult): Promise<ActionResult<{ verified: true }>> {
  const row = await openSession(sessionId);
  if (!row) return err("This checkout is no longer open.");
  if (row.s.humanVerifiedAt) return ok({ verified: true });
  if (row.method !== "world_id") return err("This store doesn't use World ID for buyer checks.");
  const cfg = worldIdConfig();
  if (!cfg) return err("World ID isn't configured on this server.");

  const proof = await verifyWorldIdProof(cfg, cfg.buyerAction, sessionId, result);
  if (!proof.ok) return err(proof.error);

  await db
    .update(checkoutSessions)
    .set({ humanVerifiedAt: new Date(), humanVerifiedVia: "world_id", buyerWorldNullifier: proof.nullifier })
    .where(and(eq(checkoutSessions.id, sessionId), isNull(checkoutSessions.humanVerifiedAt)));
  return ok({ verified: true });
}
