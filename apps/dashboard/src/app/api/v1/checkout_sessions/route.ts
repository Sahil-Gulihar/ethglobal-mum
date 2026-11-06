import { z } from "zod";
import { apiError, merchantFromApiKey } from "@/lib/api-auth";
import { createCheckoutSessionForMerchant } from "@/lib/sessions";
import { handle, json, parseBody, preflight, unauthorized } from "../_http";

const httpUrl = z.url({ protocol: /^https?$/ }).max(2048);

const CreateSession = z.object({
  orderId: z.string().trim().min(1).max(200),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'must be a decimal string like "49.99"').max(40),
  currency: z.literal("USDT").optional(),
  successUrl: httpUrl.nullish(),
  cancelUrl: httpUrl.nullish(),
  metadata: z
    .record(z.string().max(40), z.string().max(500))
    .refine((m) => Object.keys(m).length <= 20, "at most 20 keys")
    .nullish(),
});

export const OPTIONS = preflight;

export const POST = handle(async (req: Request) => {
  const merchant = await merchantFromApiKey(req);
  if (!merchant) return unauthorized();
  const body = await parseBody(req, CreateSession);
  if (body instanceof Response) return body;
  const r = await createCheckoutSessionForMerchant(merchant, body);
  if (!r.ok) return apiError(r.status, r.type, r.message);
  return json(r.value, r.created ? 201 : 200);
});
