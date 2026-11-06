import type { NextRequest } from "next/server";
import { requireMerchant } from "@/lib/auth";
import { buildLedgerCsv, ledgerCsvFilename, parseLedgerRange } from "@/lib/csv-export";
import { listLedgerEntries } from "../../_lib/queries";

/**
 * GET /dashboard/payments/export[?from=YYYY-MM-DD&to=YYYY-MM-DD]
 * CSV of the signed-in merchant's payments and succeeded refunds, for their accountant.
 */
export async function GET(request: NextRequest) {
  const m = await requireMerchant(); // redirects to /login when signed out
  const { searchParams } = request.nextUrl;
  const parsed = parseLedgerRange(searchParams.get("from"), searchParams.get("to"));
  if ("error" in parsed) {
    return new Response(`${parsed.error}\n`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const entries = await listLedgerEntries(m.id, parsed.range);
  // The BOM makes Excel read the file as UTF-8 (order ids and metadata can be non-ASCII).
  const body = "﻿" + buildLedgerCsv(entries);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${ledgerCsvFilename(m)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
