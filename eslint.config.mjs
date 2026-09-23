import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["**/tests/**", "**/fixtures/**"], message: "Test fixtures must never enter the application." }]
      }]
    }
  },
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"])
]);
