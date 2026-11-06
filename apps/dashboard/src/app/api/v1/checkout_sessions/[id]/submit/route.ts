import { z } from "zod";
import { apiError } from "@/lib/api-auth";
import { getSessionStatus, submitSessionTx } from "@/lib/sessions";
import { handle, json, parseBody, preflight } from "../../../_http";

type Ctx = { params: Promise<{ id: string }> };

const Submit = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex tx hash"),
});

/** How long we wait for the indexer's validation before answering; the tx may not be mined yet. */
const VALIDATE_TIMEOUT_MS = 6000;

async function tryValidate(txHash: `0x${string}`): Promise<void> {
  try {
    const { validateTx } = await import("@/lib/indexer");
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), VALIDATE_TIMEOUT_MS));
    const run = validateTx(txHash).catch((e: unknown) => {
      console.warn("[submit] validateTx failed", e);
      return null;
    });
    await Promise.race([run, timeout]);
  } catch (e) {
    // Indexer unavailable: the periodic indexer pass will still pick the payment up.
    console.warn("[submit] validation not triggered", e);
  }
}

export const OPTIONS = preflight;

/** Public: the widget reports its tx hash. A hint only; never marks the session paid itself. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, Submit);
  if (body instanceof Response) return body;
  const txHash = body.txHash.toLowerCase() as `0x${string}`;

  const r = await submitSessionTx(id, txHash);
  if (!r.ok) return apiError(r.status, r.type, r.message);
  if (r.value.status !== "paid") await tryValidate(txHash);

  const after = await getSessionStatus(id);
  return json({ ok: true, status: after ?? r.value.status });
});
