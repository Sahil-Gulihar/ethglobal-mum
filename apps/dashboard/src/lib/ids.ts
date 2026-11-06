import { randomBytes, createHash } from "node:crypto";

const ALPH = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function randomId(len = 20): string {
  const bytes = randomBytes(len);
  let s = "";
  for (const b of bytes) s += ALPH[b % ALPH.length];
  return s;
}

export const newId = (prefix: "mer" | "key" | "cs" | "pay" | "re" | "we" | "evt" | "whd" | "wha") =>
  `${prefix}_${randomId(20)}`;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
