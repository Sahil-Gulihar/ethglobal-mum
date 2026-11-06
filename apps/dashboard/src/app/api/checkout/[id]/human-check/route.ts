import { startHumanCheck } from "@/lib/zg/human-check";

export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

/** Hosted checkout only (same origin, reads the wc_buyer cookie): draws a fresh 0G image challenge. */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const r = await startHumanCheck(id);
    if (!r.ok) return Response.json({ error: { code: r.code, message: r.message } }, { status: r.status });
    return Response.json(r);
  } catch (e) {
    console.error("[human-check] start", e);
    return Response.json({ error: { code: "server_error", message: "Something went wrong. Try again." } }, { status: 500 });
  }
}
