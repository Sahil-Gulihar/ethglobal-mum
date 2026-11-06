import { apiError } from "@/lib/api-auth";
import { getPublicCheckoutSession } from "@/lib/sessions";
import { handle, json, preflight } from "../../_http";

type Ctx = { params: Promise<{ id: string }> };

export const OPTIONS = preflight;

/** Public: the checkout widget polls this. No secrets in the response. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const s = await getPublicCheckoutSession(id);
  if (!s) return apiError(404, "not_found", `No checkout session ${id}.`);
  return json(s);
});
