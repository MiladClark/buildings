import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  serverExternalPackages: ["postgres"],
  cacheComponents: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: [
          {
            loader: "@tailwindcss/turbopack",
            options: { base: path.join(process.cwd(), "src") },
          },
        ],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
