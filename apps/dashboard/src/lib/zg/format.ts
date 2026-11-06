/** Formats a router amount for display. 0G-settled amounts are wei strings; USD-settled ones are micro-USD. */
export function formatZgAmount(raw: string | null | undefined, currency = "0g"): string {
  if (raw == null || raw === "") return "–";
  if (raw.includes(".")) return currency === "usd" ? `$${Number(raw).toFixed(4)}` : `${Number(raw).toFixed(6)} 0G`;
  let v: bigint;
  try {
    v = BigInt(raw);
  } catch {
    return raw;
  }
  const neg = v < 0n;
  if (neg) v = -v;
  const dec = currency === "usd" ? 6 : 18;
  const base = 10n ** BigInt(dec);
  const whole = v / base;
  const frac = (v % base).toString().padStart(dec, "0").slice(0, 6);
  return `${neg ? "-" : ""}${currency === "usd" ? "$" : ""}${whole}.${frac}${currency === "usd" ? "" : " 0G"}`;
}
