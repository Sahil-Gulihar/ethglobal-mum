export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): ActionResult<T> => ({ ok: true, value });
export const err = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Pulls a human-readable message out of viem / postgres / generic errors. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Try again."): string {
  if (e && typeof e === "object") {
    const o = e as { shortMessage?: unknown; message?: unknown };
    if (typeof o.shortMessage === "string" && o.shortMessage) return o.shortMessage;
    if (typeof o.message === "string" && o.message) return o.message.split("\n")[0].slice(0, 300);
  }
  return fallback;
}
