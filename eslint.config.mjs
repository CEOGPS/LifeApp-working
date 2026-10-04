import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist",
    "**/_generated/*",
    "node_modules",
    "archive/**",
    "hermes/**",
    "ceogps_site_mirror/**",
    "src/_core/**",
    "**/*.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-expect-error": true, "ts-nocheck": true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-var": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": "off",
      "@typescript-eslint/ban-types": "off",
      "prefer-const": "off",
      "no-invalid-this": "off",
      "no-extra-parens": "off",
      "no-useless-escape": "off",
      "no-case-declarations": "off",
      "@typescript-eslint/no-this-alias": "off",
      "no-restricted-syntax": "off",
      "@typescript-eslint/no-namespace": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
]);
