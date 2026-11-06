import { formatUnits, parseUnits } from "viem";

/** "49.99" -> 49990000n at 6 decimals. Throws on bad input or too many decimals. */
export function toUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error(`Invalid amount: ${amount}`);
  const frac = amount.split(".")[1] ?? "";
  if (frac.length > decimals) throw new Error(`Amount ${amount} has more than ${decimals} decimals`);
  const units = parseUnits(amount, decimals);
  if (units <= 0n) throw new Error("Amount must be positive");
  return units;
}

export const fromUnits = (units: bigint | string, decimals: number): string =>
  formatUnits(BigInt(units), decimals);
