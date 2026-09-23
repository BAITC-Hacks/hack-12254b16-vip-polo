# Правила работы VIP POLO

Перед изменениями прочитай docs/contract.md, docs/ownership.md, docs/toolchain.md и документацию своего модуля. Не предполагается знание переписки другой сессии.

## Область работы

Нулевой этап: запускаемый каркас, JSON, типы, схемы границ, канонический ID и fixtures. Расчёт, бизнес-валидация, игровые экраны и провайдер AI ещё не реализованы. Не выдавай placeholders за готовый MVP.

## Владение

- Участник 1, Талгат: src/features/game/**, public/city/**, src/app/page.tsx, layout.tsx, globals.css; src/shared/**; tests/contracts/**, fixtures/**, game/**, e2e/**, support/**, setup.ts; scripts/**; AGENTS.md, README.md, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, .node-version, .env.example, .gitignore, все корневые настройки, .github/**; docs/contract.md, requirements.md, architecture.md, ownership.md, toolchain.md, integration.md, game-ui.md.
- Участник 2: src/data/**, src/lib/simulation/**, src/app/api/simulate/route.ts, tests/simulation/**, docs/simulation.md.
- Участник 3: src/lib/ai/**, src/features/results/**, src/app/api/analysis/route.ts, tests/ai/**, results/**, live-ai/**, docs/ai-analysis.md.

Остальное можно читать, но не изменять. На нулевом этапе Талгат создаёт стартовые файлы всех модулей, затем владение передаётся. Новые зависимости, общие типы/схемы и обновления fixtures меняет только координатор отдельной последовательной правкой после согласования. Укажи необходимость, предлагаемый формат и влияние. Модульные стили внутри своего каталога; глобальные только у Талгата.

## Проверки и ограничения

- Сохрани стек и версии. Установка: pnpm install --frozen-lockfile.
- Проверки: pnpm lint, pnpm typecheck, pnpm test, pnpm build; после build — pnpm test:e2e (нужен Chromium).
- pnpm test:ai-live сейчас честно завершается NOT_IMPLEMENTED с кодом 1. Он не входит в обычный CI.
- Runtime не импортирует tests/fixtures. Не подгонять ожидаемые числа под реализацию.
- Единый каталог и расчёт. Не добавлять дубли, случайность или формулу в UI/AI.
- Секреты только на сервере в игнорируемом .env.local; не логировать, не коммитить, не использовать NEXT_PUBLIC.
- Следуй src/shared/ports.ts. Уточнение исключений AI-помощников — docs/architecture.md.
- При замене заглушек координатор обновляет временные проверки в tests/contracts/scaffold.test.ts и соответствующий e2e одновременно с PR модуля: вместо проверки 501/NOT_IMPLEMENTED добавляется проверка реального контракта. Общие тесты типов/данных/ID сохраняются. Не отключать проверки ради зелёной сборки.

## Git и отчёты

Параллельная разработка только после проверенного merge каркаса. Три ветки от одного SHA main, отдельные клоны/worktree. Существующие изолированные ветки Codex сохранять. Ветки: chore/scaffold, feat/game-ui, feat/simulation, feat/ai-analysis, затем feat/integration. На одном компьютере порты 3000/3001/3002.

Не push в main, не force push, не сбрасывать чужие изменения, не подменять автора коммита. При доступе публиковать свою ветку и draft PR. Merge подтверждает команда. Нет доступа — оставить проверенные локальные изменения и точный статус.

Итоговый отчёт: реализовано; файлы; реальные проверки; непроверенное и блокеры; ветка/commit/PR; собственная демонстрация.
