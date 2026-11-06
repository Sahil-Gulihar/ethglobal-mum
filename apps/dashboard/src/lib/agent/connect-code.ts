import { createHash } from "node:crypto";

/** Input formats for an agent connect request (`/connect?h=&p=&n=`). */
export const CONNECT_HASH_RE = /^[0-9a-f]{64}$/;
export const CONNECT_PREFIX_RE = /^sk_test_[A-Za-z0-9]{4}$/;
export const CONNECT_NAME_MAX = 60;

/**
 * Short code the human compares between the agent's terminal and the approval page, so they know
 * the page they opened is for the key their agent just made. Must match `connectCode` in
 * packages/mcp/src/index.js: first 8 hex of sha256("wc-connect:" + hash), uppercased, as XXXX-XXXX.
 */
export function connectCode(hash: string): string {
  const hex = createHash("sha256").update(`wc-connect:${hash}`).digest("hex").slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** Validates the raw query values. Returns null when any of them is malformed. */
export function parseConnectRequest(raw: { h?: unknown; p?: unknown; n?: unknown }): { hash: string; prefix: string; name: string } | null {
  const hash = typeof raw.h === "string" ? raw.h : "";
  const prefix = typeof raw.p === "string" ? raw.p : "";
  const name = typeof raw.n === "string" ? raw.n.trim() : "";
  if (!CONNECT_HASH_RE.test(hash) || !CONNECT_PREFIX_RE.test(prefix)) return null;
  if (name.length < 1 || name.length > CONNECT_NAME_MAX) return null;
  return { hash, prefix, name };
}
