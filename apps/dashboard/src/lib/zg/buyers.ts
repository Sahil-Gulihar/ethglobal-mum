/**
 * "Sign in with 0G": a buyer connects their 0G Private Computer account with a management key
 * (scopes account:read + keys:create). We read the account address and balance with it, and mint a
 * capped, daily-reset inference key on *their* account. Human checks then spend the buyer's own 0G
 * credits (including iAI daily credits), and the dashboard shows the balance going down.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { buyers, db } from "@/lib/db";
import { env } from "@/lib/env";
import { newId, sha256 } from "@/lib/ids";
import { getBalance, mintInferenceKey, revokeInferenceKey, ZgError, type ZgBalance } from "./router";

export type Buyer = typeof buyers.$inferSelect;

const COOKIE = "wc_buyer";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** A verified-buyer badge lasts 30 days; after that the next checkout asks again. */
export const VERIFIED_FOR_MS = 30 * 24 * 60 * 60 * 1000;
/** Daily spend cap on the key we mint, in the account's settlement unit (0G or USD). One check costs about $0.01. */
const DAILY_LIMIT = process.env.ZG_BUYER_DAILY_LIMIT || "0.5";

function aesKey() {
  return createHash("sha256").update(`whitechain-buyer-keys:${env.buyerKeySecret()}`).digest();
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

export function unseal(sealed: string): string {
  const [v, iv, tag, data] = sealed.split(":");
  if (v !== "v1") throw new Error("unknown key format");
  const d = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

export function isVerified(b: Pick<Buyer, "verifiedAt"> | null | undefined): boolean {
  return !!b?.verifiedAt && Date.now() - b.verifiedAt.getTime() < VERIFIED_FOR_MS;
}

export async function getCurrentBuyer(): Promise<Buyer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [b] = await db.select().from(buyers).where(eq(buyers.sessionHash, sha256(token))).limit(1);
  return b ?? null;
}

export type SignInResult = { ok: true; buyer: Buyer; balance: ZgBalance } | { ok: false; message: string };

/** Validates the management key against 0G, mints the capped inference key, and sets the buyer cookie. */
export async function signInWithZg(mgmtKeyRaw: string): Promise<SignInResult> {
  const mgmtKey = mgmtKeyRaw.trim();
  if (!/^mk-[A-Za-z0-9_-]{8,}$/.test(mgmtKey)) {
    return { ok: false, message: "Paste a 0G management key. It starts with mk-." };
  }
  let balance: ZgBalance;
  try {
    balance = await getBalance(mgmtKey);
  } catch (e) {
    return { ok: false, message: zgMessage(e, "read your 0G balance", "account:read") };
  }
  if (!/^0x[0-9a-f]{40}$/.test(balance.address)) return { ok: false, message: "0G didn't return an account address for this key." };

  let minted: { key: string; keyId: string };
  try {
    minted = await mintInferenceKey(mgmtKey, DAILY_LIMIT);
  } catch (e) {
    return { ok: false, message: zgMessage(e, "create an inference key on your account", "keys:create") };
  }

  const token = randomBytes(32).toString("hex");
  const [existing] = await db.select().from(buyers).where(eq(buyers.zgAddress, balance.address)).limit(1);
  let buyer: Buyer;
  if (existing) {
    // Re-sign-in: replace the old app key so only one is live on the buyer's account.
    try {
      await revokeInferenceKey(unseal(existing.mgmtKeyEnc), existing.inferenceKeyId);
    } catch {
      /* old key unreadable after a secret rotation; it is capped anyway */
    }
    [buyer] = await db
      .update(buyers)
      .set({
        mgmtKeyEnc: seal(mgmtKey),
        inferenceKeyEnc: seal(minted.key),
        inferenceKeyId: minted.keyId,
        sessionHash: sha256(token),
        lastSeenAt: new Date(),
      })
      .where(eq(buyers.id, existing.id))
      .returning();
  } else {
    [buyer] = await db
      .insert(buyers)
      .values({
        id: newId("byr"),
        zgAddress: balance.address,
        mgmtKeyEnc: seal(mgmtKey),
        inferenceKeyEnc: seal(minted.key),
        inferenceKeyId: minted.keyId,
        sessionHash: sha256(token),
      })
      .returning();
  }
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + TTL_MS),
  });
  return { ok: true, buyer, balance };
}

export async function signOutBuyer(): Promise<void> {
  const jar = await cookies();
  const b = await getCurrentBuyer();
  if (b) await db.update(buyers).set({ sessionHash: null }).where(eq(buyers.id, b.id));
  jar.delete(COOKIE);
}

/** The buyer's live 0G balance, or null if 0G can't be reached right now. */
export async function buyerBalance(b: Buyer): Promise<ZgBalance | null> {
  try {
    return await getBalance(unseal(b.mgmtKeyEnc));
  } catch (e) {
    console.warn("[0g] balance read failed", b.id, e instanceof Error ? e.message : e);
    return null;
  }
}

export function zgMessage(e: unknown, what: string, scope?: string): string {
  if (e instanceof ZgError) {
    if (e.status === 401) return "0G didn't accept that key. Check that you copied all of it.";
    if (e.status === 403) return `That key isn't allowed to ${what}.${scope ? ` Give it the ${scope} scope.` : ""}`;
    if (e.status === 402) return "Your 0G account is out of credits. Top up at pc.0g.ai or wait for your daily iAI credits.";
    if (e.status === 429) return e.code === "credit_limit_exceeded" ? "You've reached today's 0G spend cap for this store. It resets daily." : "0G is rate limiting requests. Try again in a minute.";
    return `0G couldn't ${what}: ${e.message}`;
  }
  return `We couldn't reach 0G to ${what}. Try again.`;
}
