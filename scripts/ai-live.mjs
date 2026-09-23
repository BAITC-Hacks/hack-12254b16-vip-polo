import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const result = spawnSync(process.execPath, [vitest, "run", "--config", "tests/live-ai/vitest.config.ts"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit", env: process.env
});
if (result.error) console.error("Не удалось запустить live-проверку AI. Проверьте установку зависимостей.");
process.exitCode = result.status ?? 1;
