/**
 * Accountant CSV export: one row per ledger entry (a payment or a succeeded refund).
 * Pure functions only (no DB, no Next imports) so scripts/test-csv-export.ts can test them directly.
 */
import { explorerTx, fromUnits } from "@whitechain-commerce/core";

export type LedgerEntry = {
  date: Date;
  type: "payment" | "refund";
  paymentId: string;
  refundId: string | null;
  orderId: string;
  sessionId: string;
  /** Always positive base units; refunds are written as negative amounts. */
  amountUnits: string | bigint;
  decimals: number;
  status: string;
  /** The customer wallet (refunds go back to it). */
  payer: string;
  /** The merchant payout wallet the payment settled to. */
  payout: string;
  txHash: string | null;
  blockNumber: string | bigint | null;
};

export const LEDGER_CSV_COLUMNS = [
  "date",
  "type",
  "payment_id",
  "refund_id",
  "order_id",
  "session_id",
  "amount",
  "currency",
  "status",
  "payer",
  "payout",
  "tx_hash",
  "explorer_url",
  "block_number",
] as const;

/** Characters a spreadsheet may treat as the start of a formula (OWASP CSV injection list). */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * RFC 4180 cell. Text cells that start with a formula character get a leading single quote so
 * Excel/Sheets/LibreOffice show them as text. Pass `text: false` for numeric cells (amounts),
 * where a leading "-" is a real negative number.
 */
export function csvCell(value: string | number | bigint | null | undefined, { text = true }: { text?: boolean } = {}): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (text && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Decimal amount, negative for refunds: "49.99", "-20.00". */
export function ledgerAmount(e: Pick<LedgerEntry, "type" | "amountUnits" | "decimals">): string {
  const units = BigInt(e.amountUnits);
  const abs = fromUnits(units < 0n ? -units : units, e.decimals);
  return e.type === "refund" ? `-${abs}` : abs;
}

export function ledgerRow(e: LedgerEntry): string[] {
  return [
    csvCell(e.date.toISOString()),
    csvCell(e.type),
    csvCell(e.paymentId),
    csvCell(e.refundId),
    csvCell(e.orderId),
    csvCell(e.sessionId),
    csvCell(ledgerAmount(e), { text: false }),
    csvCell("USDT"),
    csvCell(e.status),
    csvCell(e.payer),
    csvCell(e.payout),
    csvCell(e.txHash),
    csvCell(e.txHash ? explorerTx(e.txHash) : null),
    csvCell(e.blockNumber === null ? null : e.blockNumber.toString(), { text: false }),
  ];
}

/** Header plus one CRLF-terminated line per entry, in the order given. */
export function buildLedgerCsv(entries: LedgerEntry[]): string {
  const lines = [LEDGER_CSV_COLUMNS.join(","), ...entries.map((e) => ledgerRow(e).join(","))];
  return lines.join("\r\n") + "\r\n";
}

/** Chronological order (oldest first); a payment sorts before refunds with the same timestamp. */
export function sortLedger(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || (a.type === b.type ? 0 : a.type === "payment" ? -1 : 1),
  );
}

/** "whitechain-commerce-chai-and-co-2026-11-06.csv". Falls back to the merchant id for non-ASCII names. */
export function ledgerCsvFilename(merchant: { id: string; name: string }, now: Date = new Date()): string {
  const slug =
    merchant.name
      .normalize("NFKD")
      .replace(/&/g, " and ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || merchant.id.toLowerCase().replace(/[^a-z0-9_]+/g, "");
  return `whitechain-commerce-${slug}-${now.toISOString().slice(0, 10)}.csv`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export type LedgerRange = { from?: Date; to?: Date };

/**
 * Parses optional ?from=&to= ISO dates. A date-only `to` (2026-11-30) includes that whole UTC day.
 * Returns `{ from, to }` with `to` exclusive, or `{ error }`.
 */
export function parseLedgerRange(fromParam: string | null, toParam: string | null): { range: LedgerRange } | { error: string } {
  const parse = (v: string, name: string, endOfDay: boolean): Date | string => {
    const ok = DATE_ONLY.test(v) || ISO_DATETIME.test(v);
    const d = new Date(DATE_ONLY.test(v) ? `${v}T00:00:00Z` : v);
    if (!ok || Number.isNaN(d.getTime())) return `${name} must be an ISO date (YYYY-MM-DD) or date-time with a timezone`;
    if (DATE_ONLY.test(v) && d.toISOString().slice(0, 10) !== v) return `${name} is not a real date`;
    if (endOfDay && DATE_ONLY.test(v)) return new Date(d.getTime() + 86_400_000);
    if (endOfDay) return new Date(d.getTime() + 1); // inclusive date-time bound, stored as exclusive
    return d;
  };
  const range: LedgerRange = {};
  if (fromParam) {
    const r = parse(fromParam.trim(), "from", false);
    if (typeof r === "string") return { error: r };
    range.from = r;
  }
  if (toParam) {
    const r = parse(toParam.trim(), "to", true);
    if (typeof r === "string") return { error: r };
    range.to = r;
  }
  if (range.from && range.to && range.from >= range.to) return { error: "from must be before to" };
  return { range };
}
