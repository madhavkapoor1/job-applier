import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright (used for PDF rendering + assisted apply) must not be bundled —
  // it spawns its own browser binaries and native helpers at runtime.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
