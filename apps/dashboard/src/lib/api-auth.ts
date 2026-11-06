import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, apiKeys, merchants } from "./db";
import { sha256 } from "./ids";
import type { Merchant } from "./auth";

/** Resolves `Authorization: Bearer sk_test_...` to an active merchant, or null. */
export async function merchantFromApiKey(req: Request): Promise<Merchant | null> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(sk_test_[A-Za-z0-9]+)$/.exec(h.trim());
  if (!m) return null;
  const rows = await db
    .select({ merchant: merchants, keyId: apiKeys.id })
    .from(apiKeys)
    .innerJoin(merchants, eq(apiKeys.merchantId, merchants.id))
    .where(and(eq(apiKeys.keyHash, sha256(m[1])), isNull(apiKeys.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row || row.merchant.status !== "active") return null;
  void db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.keyId)).catch(() => {});
  return row.merchant;
}

export const apiError = (status: number, type: string, message: string) =>
  Response.json({ error: { type, message } }, { status, headers: corsHeaders });

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
