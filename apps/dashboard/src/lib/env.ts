/** Server-only env. .env lives at the repo root; next.config.ts loads it. */
export const env = {
  rpcUrl: () => must("WHITECHAIN_RPC_URL"),
  deployerKey: () => must("DEPLOYER_PRIVATE_KEY") as `0x${string}`,
  appUrl: () => process.env.APP_URL || "http://localhost:3000",
  skipWorldId: () => process.env.SKIP_WORLD_ID !== "false", // default true until World ID lands
  cronSecret: () => process.env.CRON_SECRET || "dev-cron-secret",
};

function must(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
}
