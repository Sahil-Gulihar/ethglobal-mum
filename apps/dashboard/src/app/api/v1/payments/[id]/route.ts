import { and, eq } from "drizzle-orm";
import { apiError, merchantFromApiKey } from "@/lib/api-auth";
import { db, checkoutSessions, payments } from "@/lib/db";
import { toPaymentObject } from "@/lib/serializers";
import { handle, json, preflight, unauthorized } from "../../_http";

type Ctx = { params: Promise<{ id: string }> };

export const OPTIONS = preflight;

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const merchant = await merchantFromApiKey(req);
  if (!merchant) return unauthorized();
  const { id } = await ctx.params;
  const [row] = await db
    .select({ p: payments, s: checkoutSessions })
    .from(payments)
    .innerJoin(checkoutSessions, eq(checkoutSessions.id, payments.sessionId))
    .where(and(eq(payments.id, id), eq(payments.merchantId, merchant.id)))
    .limit(1);
  if (!row) return apiError(404, "not_found", `No payment ${id}.`);
  return json(toPaymentObject(row.p, row.s));
});
