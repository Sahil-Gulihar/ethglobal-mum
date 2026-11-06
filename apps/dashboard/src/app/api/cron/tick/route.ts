import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runIndexerOnce } from "@/lib/indexer";
import { deliverDue } from "@/lib/webhooks";

export const maxDuration = 60;

/** GET /api/cron/tick with `Authorization: Bearer $CRON_SECRET`: one indexer pass + due webhooks. */
export async function GET(request: Request) {
  const secret = env.cronSecret();
  if (!secret) {
    return Response.json({ error: { type: "server_error", message: "CRON_SECRET is not configured" } }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: { type: "authentication_error", message: "Invalid cron secret" } }, { status: 401 });
  }

  const started = Date.now();
  let indexer: unknown = null;
  let webhooks: unknown = null;
  let ok = true;
  try {
    indexer = await runIndexerOnce();
  } catch (e) {
    ok = false;
    indexer = { error: e instanceof Error ? e.message : String(e) };
  }
  try {
    webhooks = { attempted: await deliverDue() };
  } catch (e) {
    ok = false;
    webhooks = { error: e instanceof Error ? e.message : String(e) };
  }
  return Response.json({ ok, indexer, webhooks, durationMs: Date.now() - started }, { status: ok ? 200 : 500 });
}
