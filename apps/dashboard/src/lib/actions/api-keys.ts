"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { apiKeys, db } from "@/lib/db";
import { requireMerchant } from "@/lib/auth";
import { newId, randomId, sha256 } from "@/lib/ids";
import { err, ok, type ActionResult } from "./result";

/** Creates a secret key. The plaintext is returned exactly once; only its sha256 is stored. */
export async function createApiKey(name?: string): Promise<ActionResult<{ id: string; key: string; prefix: string }>> {
  const m = await requireMerchant();
  if (m.status !== "active") return err("Verify your account to unlock API keys.");
  const label = (name ?? "").trim().slice(0, 60) || "Default";
  const key = `sk_test_${randomId(32)}`;
  const prefix = key.slice(0, 12);
  const id = newId("key");
  await db.insert(apiKeys).values({ id, merchantId: m.id, name: label, prefix, keyHash: sha256(key) });
  // No revalidatePath here: refreshing now re-renders the onboarding checklist, which unmounts the
  // dialog before the one-time key is shown. The dialog calls router.refresh() when it closes.
  return ok({ id, key, prefix });
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const m = await requireMerchant();
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.merchantId, m.id), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  if (!rows.length) return err("Key not found or already revoked.");
  revalidatePath("/dashboard", "layout");
  return ok(undefined);
}
