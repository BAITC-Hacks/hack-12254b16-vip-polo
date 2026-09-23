import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../", import.meta.url));
const localEnvironment = fileURLToPath(new URL("../../.env.local", import.meta.url));
// This optional ignored server file is never printed or copied into test artifacts.
if (existsSync(localEnvironment)) loadEnvFile(localEnvironment);

export default defineConfig({
  root,
  resolve: { alias: {
    "@": fileURLToPath(new URL("../../src", import.meta.url)),
    "server-only": fileURLToPath(new URL("../support/server-only.ts", import.meta.url)),
  } },
  test: {
    environment: "node",
    include: ["tests/live-ai/**/*.live.test.ts"],
    testTimeout: 70000,
    retry: 0,
  },
});
