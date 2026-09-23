# Среда и версии

Node.js 24.19.0, pnpm 11.19.0. Закреплены в .node-version, engines и packageManager. Первичная проверка использует bundled runtime Codex на macOS; его абсолютные пути не являются требованиями проекта.

| Пакет | Версия |
|---|---|
| next / eslint-config-next | 16.3.6 |
| react / react-dom | 19.3.0 |
| typescript | 6.0.3 |
| zod | 4.6.5 |
| vitest | 5.0.1 |
| @testing-library/react | 16.3.3 |
| @testing-library/dom | 10.4.2 |
| @testing-library/jest-dom | 7.0.1 |
| @testing-library/user-event | 14.6.7 |
| jsdom | 30.1.1 |
| @playwright/test | 1.63.0 |
| eslint | 9.39.5 |
| @types/node | 24.13.6 |
| @types/react / @types/react-dom | 19.3.0 |
| server-only | 0.0.1 |

Проверено по npm registry. TypeScript 6.0.3 выбран вместо latest 7.0.2 из-за peer-диапазона typescript-eslint 8.70.1 (<6.1.0). ESLint 9.39.5 выбран вместо 10, поскольку React/import/a11y-плагины Next ограничивают совместимость ESLint 9. npm помечает ESLint 9 как deprecated; это известное ограничение совместимого набора, обновление потребуется вместе с плагинами. @types/node соответствует Node 24. Все прямые версии точные, транзитивные закреплены lockfile.

pnpm-workspace.yaml использует allowBuilds для unrs-resolver, esbuild, sharp; строгие engines/peer dependencies и saveExact. Это поддерживаемый pnpm 11 формат. В файл также записаны точные minimumReleaseAgeExclude для выбранного выпуска Next, автоматически добавленные pnpm. Другие свежие пакеты глобально не разрешены.

После нулевого этапа — pnpm install --frozen-lockfile. typecheck сначала вызывает next typegen, поэтому работает до build в чистом клоне. test исключает e2e и live-AI. test:e2e требует build и установленный Chromium; тестовый production-порт 3100.

Документация: https://nextjs.org/docs/app/getting-started/installation и https://pnpm.io/settings . Результаты проверок — docs/integration.md.
