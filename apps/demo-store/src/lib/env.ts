export const WC_API_BASE = process.env.WC_API_BASE || "http://localhost:3000";
export const STORE_URL = process.env.DEMO_STORE_URL || "http://localhost:3001";

export function requireEnv(name: "WC_SECRET_KEY" | "WC_WEBHOOK_SECRET"): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to the repo root .env (see apps/demo-store/README.md).`);
  return v;
}
