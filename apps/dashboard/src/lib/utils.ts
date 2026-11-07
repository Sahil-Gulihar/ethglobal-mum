/** Tiny dependency-free `cn` (shadcn convention). Later classes win only by order; avoid conflicting utilities. */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}

export function shortAddr(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr) return "";
  return addr.length <= head + tail + 1 ? addr : `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function shortHash(hash: string | null | undefined): string {
  return shortAddr(hash, 8, 6);
}

const dateTimeOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
const dayOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmtFor(kind: "dt" | "d", timeZone?: string): Intl.DateTimeFormat {
  const key = `${kind}:${timeZone ?? ""}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { ...(kind === "dt" ? dateTimeOpts : dayOpts), timeZone });
    fmtCache.set(key, f);
  }
  return f;
}

/**
 * Formats in `timeZone`, or the runtime's local zone when omitted. On the server that is UTC,
 * so for user-facing output render `<LocalTime>` instead, which formats in the browser.
 */
export function formatDateTime(d: Date | string | null | undefined, timeZone?: string): string {
  if (!d) return "—";
  return fmtFor("dt", timeZone).format(typeof d === "string" ? new Date(d) : d);
}

export function formatDate(d: Date | string | null | undefined, timeZone?: string): string {
  if (!d) return "—";
  return fmtFor("d", timeZone).format(typeof d === "string" ? new Date(d) : d);
}

/** Formats a decimal string like "49.5" as "49.50" (min 2 decimals, keeps extra precision). */
export function formatAmount(amount: string): string {
  const [int, frac = ""] = amount.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const f = frac.replace(/0+$/, "").padEnd(2, "0");
  return `${grouped}.${f}`;
}

export function relativeTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const t = (typeof d === "string" ? new Date(d) : d).getTime();
  const diff = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
