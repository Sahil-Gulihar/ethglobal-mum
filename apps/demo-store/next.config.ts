import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// Load the monorepo root .env (WC_SECRET_KEY, WC_WEBHOOK_SECRET, WC_API_BASE, ...).
loadEnvConfig(path.resolve(__dirname, "../.."));

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
