import path from "path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "dist", ...configDefaults.exclude],
    },
    projects: [
      {
        // will inherit options from this config like plugins and pool
        extends: true,
        test: {
          name: "unit",
          include: [ "test/unit/*" ],
        },
      },
      {
        extends: true,
        test: {
          globalSetup: "./test/integration/devnet.ts",
          testTimeout: 0,
          name: "integration",
          include: [
            "./test/integration/state.test.ts",
            "./test/integration/fund.test.ts",
            "./test/integration/transfer.test.ts",
            "./test/integration/rollover.test.ts",
          ],
        },
      },
    ]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
