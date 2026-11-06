import { desc, eq } from "drizzle-orm";
import { apiError, merchantFromApiKey } from "@/lib/api-auth";
import { db, checkoutSessions, payments } from "@/lib/db";
import { toPaymentObject } from "@/lib/serializers";
import { handle, json, preflight, unauthorized } from "../_http";

export const OPTIONS = preflight;

/** GET /api/v1/payments?limit=20 -> { data: PaymentObject[] }, newest first, limit 1..100 (default 20). */
export const GET = handle(async (req: Request) => {
  const merchant = await merchantFromApiKey(req);
  if (!merchant) return unauthorized();
  const raw = new URL(req.url).searchParams.get("limit");
  const limit = raw === null ? 20 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return apiError(400, "invalid_request", "limit must be an integer between 1 and 100.");
  }
  const rows = await db
    .select({ p: payments, s: checkoutSessions })
    .from(payments)
    .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
    .where(eq(payments.merchantId, merchant.id))
    .orderBy(desc(payments.createdAt), desc(payments.blockNumber))
    .limit(limit);
  return json({ data: rows.map(({ p, s }) => toPaymentObject(p, s)) });
});
