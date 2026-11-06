import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db, merchants, authSessions } from "./db";
import { sha256 } from "./ids";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "wc_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type Merchant = typeof merchants.$inferSelect;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Creates a session row and sets the httpOnly cookie. Call from a Server Action or Route Handler. */
export async function startSession(merchantId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(authSessions).values({ id: sha256(token), merchantId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(authSessions).where(eq(authSessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Returns the logged-in merchant or null. */
export async function getCurrentMerchant(): Promise<Merchant | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ m: merchants })
    .from(authSessions)
    .innerJoin(merchants, eq(authSessions.merchantId, merchants.id))
    .where(and(eq(authSessions.id, sha256(token)), gt(authSessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.m ?? null;
}

/** For dashboard pages: redirects to /login if signed out. */
export async function requireMerchant(): Promise<Merchant> {
  const m = await getCurrentMerchant();
  if (!m) redirect("/login");
  return m;
}
