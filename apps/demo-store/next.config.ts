import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// Load the monorepo root .env (WC_SECRET_KEY, WC_WEBHOOK_SECRET, WC_API_BASE, ...).
// forceReload=true: Next has already called loadEnvConfig for this app dir, and
// @next/env caches the first result, so without it the root .env is silently skipped
// (e.g. DATABASE_URL missing during `next build` page-data collection).
loadEnvConfig(path.resolve(__dirname, "../.."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  transpilePackages: ["@whitechain-commerce/react", "@whitechain-commerce/core"],
  env: {
    NEXT_PUBLIC_WC_API_BASE:
      process.env.NEXT_PUBLIC_WC_API_BASE ?? process.env.WC_API_BASE ?? "http://localhost:3000",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
