import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// forceReload=true: Next has already called loadEnvConfig for this app dir, and
// @next/env caches the first result, so without it the root .env is silently skipped
// (e.g. DATABASE_URL missing during `next build` page-data collection).
loadEnvConfig(path.resolve(__dirname, "../.."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  transpilePackages: ["@whitechain-commerce/core", "@whitechain-commerce/react"],
  // Tailwind v4 via the Turbopack loader (no postcss config in this app).
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
