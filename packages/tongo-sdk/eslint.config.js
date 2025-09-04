// eslint.config.js
import { defineConfig } from "eslint/config";

import * as projectConfig from "../../eslint.config.js"
import * as typescript_eslint from "typescript-eslint";

export default defineConfig([
  projectConfig.default,
  {
    plugins: {
      typescript_eslint
    },
    rules: {
      semi: "error",
      "prefer-const": "error",
      "@typescript-eslint/no-non-null-assertion": "off"
    },
  },
]);
