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
  /** 0G Private Computer router. ZG_API_KEY (sk-) pays for guest human checks; signed-in buyers pay with their own account. */
  zg: () => ({
    baseUrl: (process.env.ZG_ROUTER_URL || "https://router-api.0g.ai/v1").replace(/\/$/, ""),
    apiKey: process.env.ZG_API_KEY || null,
    imageModel: process.env.ZG_IMAGE_MODEL || "z-image-turbo",
    judgeModel: process.env.ZG_JUDGE_MODEL || "0gm-1.0-35b-a3b",
    asrModel: process.env.ZG_ASR_MODEL || "whisper-large-v3",
    /** "private" pins every call to TEE providers; set ZG_TRUST_MODE= (empty) to let the router pick. */
    trustMode: process.env.ZG_TRUST_MODE ?? "private",
  }),
  /** 32+ char secret that encrypts buyers' 0G keys at rest. Falls back to CRON_SECRET so a deploy without it still works. */
  buyerKeySecret: () => process.env.BUYER_KEY_SECRET || must("CRON_SECRET"),
  /** World ID (IDKit 4). `staging` works with the simulator at https://simulator.worldcoin.org. */
  worldId: () => ({
    appId: must("WORLD_APP_ID") as `app_${string}`,
    rpId: must("WORLD_RP_ID"),
    signingKey: must("WORLD_RP_SIGNER_PRIVATE_KEY"),
    action: process.env.WORLD_ACTION || "merchant-onboarding",
    /** Action for the verified-buyer check at checkout. Defaults to WORLD_ACTION so no extra Developer Portal setup is needed. */
    buyerAction: process.env.WORLD_BUYER_ACTION || process.env.WORLD_ACTION || "merchant-onboarding",
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
