import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    // Only the test runner bypasses the server-only marker; Next enforces it in production.
    "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url))
  } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "tests/live-ai/**"],
    setupFiles: ["./tests/setup.ts"]
  }
});
