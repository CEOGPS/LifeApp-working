import path from "node:path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    passWithNoTests: true,
    restoreMocks: true,
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/src/_core/tests/**",
      "**/.git/**",
    ],
    projects: [
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "frontend",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/vitest.setup.ts"],
        },
      },
    ],
  },
});
