import type { IDKitResult } from "@worldcoin/idkit-core";
import { apiError } from "@/lib/api-auth";
import { completeBuyerWorldId } from "@/lib/buyer-world-id";
import { handle, json, preflight } from "../../../../_http";

type Ctx = { params: Promise<{ id: string }> };

export const OPTIONS = preflight;

/** Public: verifies the buyer's World ID proof with World, then unlocks payment for this checkout. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as IDKitResult | null;
  if (!body || typeof body !== "object") return apiError(400, "invalid_request", "Send the IDKit result as JSON.");
  const r = await completeBuyerWorldId(id, body);
  if (!r.ok) return apiError(400, "invalid_request", r.error);
  return json(r.value);
});
