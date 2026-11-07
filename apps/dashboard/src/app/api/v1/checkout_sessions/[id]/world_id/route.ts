import { apiError } from "@/lib/api-auth";
import { startBuyerWorldId } from "@/lib/buyer-world-id";
import { handle, json, preflight } from "../../../_http";

type Ctx = { params: Promise<{ id: string }> };

export const OPTIONS = preflight;

/** Public: signs a World ID request bound to this checkout (verified buyers). `{ verified: true }` if already done. */
export const POST = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const r = await startBuyerWorldId(id);
  if (!r.ok) return apiError(409, "conflict", r.error);
  return json(r.value);
});
