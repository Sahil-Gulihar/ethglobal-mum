/**
 * Tests the accountant CSV export: the pure builder in src/lib/csv-export.ts, then the merchant-scoped
 * ledger query against local Postgres (two throwaway merchants, cleaned up afterwards).
 * Run from apps/dashboard:
 *   pnpm test:csv
 *   (= tsx --conditions=react-server --env-file=../../.env scripts/test-csv-export.ts)
 */
import assert from "node:assert/strict";
import { inArray } from "drizzle-orm";
import { chainMerchantId, chainOrderId, chainPaymentId } from "@whitechain-commerce/core";
import {
  LEDGER_CSV_COLUMNS,
  buildLedgerCsv,
  csvCell,
  ledgerCsvFilename,
  parseLedgerRange,
  type LedgerEntry,
} from "../src/lib/csv-export";

let passes = 0;
let failures = 0;
async function test(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passes++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${label}\n       ${(e as Error).message.split("\n").join("\n       ")}`);
  }
}

/** Minimal RFC 4180 parser, so the tests check what a spreadsheet would actually read. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endCell();
    else if (c === "\r" && text[i + 1] === "\n") {
      endCell();
      rows.push(row);
      row = [];
      i++;
    } else cell += c;
  }
  if (cell || row.length) {
    endCell();
    rows.push(row);
  }
  return rows;
}

const TX = `0x${"ab".repeat(32)}`;
const base: LedgerEntry = {
  date: new Date("2026-11-01T10:00:00.000Z"),
  type: "payment",
  paymentId: "pay_1",
  refundId: null,
  orderId: "order_1",
  sessionId: "cs_1",
  amountUnits: "49990000",
  decimals: 6,
  status: "succeeded",
  payer: "0x1111111111111111111111111111111111111111",
  payout: "0x000000000000000000000000000000000000dEaD",
  txHash: TX,
  blockNumber: 12373441n,
};

async function pureTests() {
  console.log("csv builder (pure)");
  await test("header has the 14 columns in order", () => {
    const [header] = parseCsv(buildLedgerCsv([]));
    assert.deepEqual(header, [...LEDGER_CSV_COLUMNS]);
    assert.equal(header.join(","), "date,type,payment_id,refund_id,order_id,session_id,amount,currency,status,payer,payout,tx_hash,explorer_url,block_number");
  });
  await test("payment row values", () => {
    const [, row] = parseCsv(buildLedgerCsv([base]));
    assert.deepEqual(row, [
      "2026-11-01T10:00:00.000Z", "payment", "pay_1", "", "order_1", "cs_1", "49.99", "USDT", "succeeded",
      base.payer, base.payout, TX, `https://explorer.testnet.whitechain.io/tx/${TX}`, "12373441",
    ]);
  });
  await test("refund amount is negative and NOT quote-prefixed", () => {
    const csv = buildLedgerCsv([{ ...base, type: "refund", refundId: "re_1", amountUnits: "20000000" }]);
    const [, row] = parseCsv(csv);
    assert.equal(row[6], "-20.00");
    assert.equal(row[3], "re_1");
    assert.ok(csv.includes(",-20.00,USDT,"), "raw amount cell is a bare negative number");
  });
  await test("sub-cent amounts keep full precision", () => {
    const [, row] = parseCsv(buildLedgerCsv([{ ...base, amountUnits: "1234567" }]));
    assert.equal(row[6], "1.234567");
  });
  await test("commas, quotes and newlines are escaped (RFC 4180)", () => {
    const orderId = 'A,"B"\nC\r\nD';
    const csv = buildLedgerCsv([{ ...base, orderId }]);
    assert.ok(csv.includes(`"A,""B""\nC\r\nD"`), "quoted with doubled quotes");
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2, "embedded newlines don't split the record");
    assert.equal(rows[1][4], orderId);
    assert.equal(rows[1].length, LEDGER_CSV_COLUMNS.length);
  });
  await test("formula injection: = + - @ tab CR in text cells get a leading quote", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      const [, row] = parseCsv(buildLedgerCsv([{ ...base, orderId: evil }]));
      assert.equal(row[4], `'${evil}`, `order_id ${JSON.stringify(evil)}`);
    }
    assert.equal(csvCell("=1+1"), "'=1+1");
    assert.equal(csvCell("-5", { text: false }), "-5");
    assert.equal(csvCell("=a,b"), `"'=a,b"`, "prefix happens before quoting");
    assert.equal(csvCell("safe=1"), "safe=1", "only the first character matters");
  });
  await test("null cells are empty; CRLF line endings; trailing newline", () => {
    const csv = buildLedgerCsv([{ ...base, txHash: null, blockNumber: null }]);
    const [, row] = parseCsv(csv);
    assert.equal(row[11], "");
    assert.equal(row[12], "");
    assert.equal(row[13], "");
    assert.ok(csv.endsWith("\r\n") && !/[^\r]\n/.test(csv.replace(/"[^"]*"/g, "")));
  });
  await test("filename", () => {
    const d = new Date("2026-11-06T23:59:00Z");
    assert.equal(ledgerCsvFilename({ id: "mer_x", name: "Chai & Co." }, d), "whitechain-commerce-chai-and-co-2026-11-06.csv");
    assert.equal(ledgerCsvFilename({ id: "mer_AbC", name: "日本" }, d), "whitechain-commerce-mer_abc-2026-11-06.csv");
    assert.equal(ledgerCsvFilename({ id: "mer_x", name: 'a"b\r\nc' }, d), "whitechain-commerce-a-b-c-2026-11-06.csv");
  });
  await test("date range parsing", () => {
    const r = parseLedgerRange("2026-11-01", "2026-11-30");
    assert.ok("range" in r);
    assert.equal(r.range.from?.toISOString(), "2026-11-01T00:00:00.000Z");
    assert.equal(r.range.to?.toISOString(), "2026-12-01T00:00:00.000Z", "date-only to includes the whole day");
    const t = parseLedgerRange("2026-11-01T05:30:00+05:30", null);
    assert.ok("range" in t && t.range.from?.toISOString() === "2026-11-01T00:00:00.000Z" && !t.range.to);
    assert.deepEqual(parseLedgerRange(null, null), { range: {} });
    for (const [f, to] of [["yesterday", null], ["2026-02-30", null], ["2026-11-01T10:00", null], [null, "11/30/2026"], ["2026-11-02", "2026-11-01"]]) {
      assert.ok("error" in parseLedgerRange(f, to), `rejects ${f} / ${to}`);
    }
  });
}

async function dbTests() {
  console.log("ledger query (Postgres, merchant-scoped)");
  const { db, merchants, checkoutSessions, payments, refunds } = await import("../src/lib/db");
  const { newId, randomId } = await import("../src/lib/ids");
  const { listLedgerEntries } = await import("../src/app/(app)/dashboard/_lib/queries");

  const mk = async (name: string) => {
    const id = newId("mer");
    await db.insert(merchants).values({ id, email: `csv+${randomId(8)}@example.test`, passwordHash: "x:y", name, status: "active", chainMerchantId: chainMerchantId(id) });
    return id;
  };
  const A = await mk("CSV A");
  const B = await mk("CSV B");
  const ids = [A, B];
  const pay = async (merchantId: string, amountUnits: string, createdAt: Date) => {
    const sid = newId("cs");
    const oid = chainOrderId(sid);
    await db.insert(checkoutSessions).values({
      id: sid, merchantId, orderId: `order_${randomId(6)}`, chainOrderId: oid, amount: "1", amountUnits, decimals: 6, status: "paid", expiresAt: createdAt,
    });
    const id = newId("pay");
    await db.insert(payments).values({
      id, sessionId: sid, merchantId, chainPaymentId: chainPaymentId(chainMerchantId(merchantId), oid),
      payer: "0x1111111111111111111111111111111111111111", payout: "0x000000000000000000000000000000000000dEaD",
      amountUnits, decimals: 6, txHash: `0x${randomId(16).toLowerCase().padEnd(64, "0")}`, blockNumber: 100n, logIndex: 0, createdAt,
    });
    return id;
  };

  try {
    const p1 = await pay(A, "49990000", new Date("2026-10-01T09:00:00Z"));
    const p2 = await pay(A, "10000000", new Date("2026-11-02T09:00:00Z"));
    const pb = await pay(B, "77000000", new Date("2026-11-02T09:00:00Z"));
    const reOk = newId("re");
    await db.insert(refunds).values([
      { id: reOk, paymentId: p1, merchantId: A, amountUnits: "20000000", status: "succeeded", txHash: `0x${"ef".repeat(32)}`, blockNumber: 200n, logIndex: 1, createdAt: new Date("2026-11-03T09:00:00Z") },
      { id: newId("re"), paymentId: p1, merchantId: A, amountUnits: "5000000", status: "pending", createdAt: new Date("2026-11-03T10:00:00Z") },
      { id: newId("re"), paymentId: pb, merchantId: B, amountUnits: "1000000", status: "succeeded", txHash: `0x${"cd".repeat(32)}`, blockNumber: 201n, logIndex: 2, createdAt: new Date("2026-11-03T09:00:00Z") },
    ]);

    await test("only merchant A's payments and succeeded refunds, oldest first", async () => {
      const rows = await listLedgerEntries(A);
      assert.deepEqual(rows.map((r) => [r.type, r.paymentId, r.refundId]), [["payment", p1, null], ["payment", p2, null], ["refund", p1, reOk]]);
      assert.ok(!rows.some((r) => r.paymentId === pb), "no merchant B rows");
    });
    await test("range filters on the entry date (to is exclusive after parsing)", async () => {
      const parsed = parseLedgerRange("2026-11-01", "2026-11-02");
      assert.ok("range" in parsed);
      const rows = await listLedgerEntries(A, parsed.range);
      assert.deepEqual(rows.map((r) => r.paymentId), [p2]);
    });
    await test("end to end CSV for merchant A", async () => {
      const csv = parseCsv(buildLedgerCsv(await listLedgerEntries(A)));
      assert.equal(csv.length, 4);
      assert.deepEqual(csv.slice(1).map((r) => r[6]), ["49.99", "10.00", "-20.00"]);
      assert.equal(csv[3][13], "200");
    });
  } finally {
    await db.delete(refunds).where(inArray(refunds.merchantId, ids));
    await db.delete(payments).where(inArray(payments.merchantId, ids));
    await db.delete(checkoutSessions).where(inArray(checkoutSessions.merchantId, ids));
    await db.delete(merchants).where(inArray(merchants.id, ids));
  }
}

async function main() {
  await pureTests();
  if (process.env.DATABASE_URL) await dbTests();
  else console.log("(DATABASE_URL not set: skipping the Postgres ledger query tests)");
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
