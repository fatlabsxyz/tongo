import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@scure/bip32", "@scure/bip39"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"],
    resolveAlias: {
      // starknet.js has `require("fs")` and `require("path")` inside a server-only
      // codepath. Tubropack tries to resolve them statically. Map them to empty
      // for the client bundle.
      fs: { browser: path.resolve(__dirname, "src/lib/empty.ts") },
      path: { browser: path.resolve(__dirname, "src/lib/empty.ts") },
      crypto: { browser: path.resolve(__dirname, "src/lib/empty.ts") },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
      };
    }
    // Resolve `import "./foo.js"` to `./foo.ts` when the .js doesn't exist —
    // this matches the SDK's NodeNext-style imports.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
