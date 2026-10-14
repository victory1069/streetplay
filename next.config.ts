import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Demo mode's in-process Postgres (WASM) must load from node_modules as-is.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
  experimental: {
    // Failed navigations and Server Actions wait for the network instead of
    // throwing. Pairs with the service worker in public/sw.js.
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Everything except the OBS overlay refuses to be framed.
        source: "/((?!overlay).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
