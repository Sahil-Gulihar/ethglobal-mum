/** Server-only env. .env lives at the repo root; next.config.ts loads it. */
export const env = {
  rpcUrl: () => must("WHITECHAIN_RPC_URL"),
  deployerKey: () => must("DEPLOYER_PRIVATE_KEY") as `0x${string}`,
  appUrl: () => process.env.APP_URL || "http://localhost:3000",
  /** Explicit SKIP_WORLD_ID wins; when unset, skip only outside production (fail closed). */
  skipWorldId: () =>
    process.env.SKIP_WORLD_ID !== undefined && process.env.SKIP_WORLD_ID !== ""
      ? process.env.SKIP_WORLD_ID !== "false"
      : process.env.NODE_ENV !== "production",
  /** World ID (IDKit 4). `staging` works with the simulator at https://simulator.worldcoin.org. */
  worldId: () => ({
    appId: must("WORLD_APP_ID") as `app_${string}`,
    rpId: must("WORLD_RP_ID"),
    signingKey: must("WORLD_RP_SIGNER_PRIVATE_KEY"),
    action: process.env.WORLD_ACTION || "merchant-onboarding",
    environment: worldEnvironment(),
  }),
};

function worldEnvironment(): "production" | "staging" {
  const v = process.env.WORLD_ENVIRONMENT;
  if (v === "production" || v === "staging") return v;
  return "staging";
}

function must(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
}
