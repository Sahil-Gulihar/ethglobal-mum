/**
 * Background worker: indexer pass + due webhook deliveries every 4 s.
 *   pnpm --filter dashboard worker
 */
import "../src/lib/indexer/node-shim";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

loadEnvConfig(resolve(__dirname, "../../.."), process.env.NODE_ENV !== "production");

const INTERVAL_MS = 4000;

async function main() {
  const { runIndexerOnce } = await import("@/lib/indexer");
  const { deliverDue } = await import("@/lib/webhooks");
  let stopping = false;
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.on(sig, () => {
      if (stopping) process.exit(1);
      stopping = true;
      console.log(`[worker] ${sig}, finishing current tick`);
    });

  console.log(`[worker] started, tick every ${INTERVAL_MS / 1000}s`);
  let lastIdle = 0;
  while (!stopping) {
    const t0 = Date.now();
    let idx: Awaited<ReturnType<typeof runIndexerOnce>> | null = null;
    let sent = 0;
    try {
      idx = await runIndexerOnce();
    } catch (e) {
      console.error("[worker] indexer error:", errMsg(e));
    }
    try {
      sent = await deliverDue();
    } catch (e) {
      console.error("[worker] webhooks error:", errMsg(e));
    }
    const busy = (idx?.processed ?? 0) > 0 || sent > 0;
    // Log every busy tick, otherwise a heartbeat once a minute.
    if (busy || Date.now() - lastIdle > 60_000) {
      if (!busy) lastIdle = Date.now();
      console.log(
        `[worker] blocks ${idx ? `${idx.fromBlock}..${idx.toBlock}` : "-"} events=${idx?.processed ?? 0} webhooks=${sent} (${Date.now() - t0}ms)`,
      );
    }
    const wait = Math.max(0, INTERVAL_MS - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
  }
  process.exit(0);
}

function errMsg(e: unknown) {
  return e instanceof Error ? (e as Error & { shortMessage?: string }).shortMessage ?? e.message : String(e);
}

main().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});
