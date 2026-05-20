import type { NextConfig } from "next";

const linkedSdk = process.env.HOT_CHAT_LINKED_SDK === "1";

const nextConfig: NextConfig = linkedSdk
  ? {
      // Required only when @hot-dev/sdk is pnpm-linked from sibling hot-js.
      transpilePackages: ["@hot-dev/sdk"],
      experimental: { externalDir: true },
    }
  : {};

export default nextConfig;
