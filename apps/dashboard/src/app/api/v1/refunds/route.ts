import { z } from "zod";
import { apiError, merchantFromApiKey } from "@/lib/api-auth";
import { createPendingRefund, listRefunds } from "@/lib/refunds";
import { handle, json, parseBody, preflight, unauthorized } from "../_http";

const CreateRefund = z.object({
  paymentId: z.string().trim().min(1).max(100),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'must be a decimal string like "10.00"').max(40),
});

export const OPTIONS = preflight;

/** Creates a pending refund. The merchant confirms it in the dashboard by signing with the payout wallet. */
export const POST = handle(async (req: Request) => {
  const merchant = await merchantFromApiKey(req);
  if (!merchant) return unauthorized();
  const body = await parseBody(req, CreateRefund);
  if (body instanceof Response) return body;
  const r = await createPendingRefund(merchant.id, body);
  if (!r.ok) return apiError(r.status, r.type, r.message);
  return json(r.value, 201);
});

/** GET /api/v1/refunds?paymentId=pay_... -> { data: RefundObject[] } newest first. */
export const GET = handle(async (req: Request) => {
  const merchant = await merchantFromApiKey(req);
  if (!merchant) return unauthorized();
  const paymentId = new URL(req.url).searchParams.get("paymentId") ?? undefined;
  return json({ data: await listRefunds(merchant.id, { paymentId }) });
});
