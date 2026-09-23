# Правила работы VIP POLO

Перед изменениями прочитай docs/contract.md, docs/ownership.md, docs/toolchain.md и документацию своего модуля. Не предполагается знание переписки другой сессии.

## Область работы

Текущая ветка feat/integration-audit — проверяемый кандидат из PR №2/№3/№4/№5, не main. Реализованы расчёт и бизнес-валидация, игровой интерфейс, два API, серверный AI-адаптер и ResultsPanel. Без доступного провайдера анализ возвращает честно обозначенный fallback; это не подтверждение настоящего AI.

Состав и результаты проверки фиксируй в docs/integration.md. Не переноси старые выводы о заглушках или успехе отдельных модулей на текущую интеграцию. Новое обновление карты среди опубликованных исходных веток не найдено: CityMap остаётся из PR №3. Полный браузерный CLI-прогон и live-AI пока не подтверждены для кандидата.

## Владение

- Участник 1, Талгат: src/features/game/**, public/city/**, src/app/page.tsx, layout.tsx, globals.css; src/shared/**; tests/contracts/**, fixtures/**, game/**, e2e/**, support/**, setup.ts; scripts/**; AGENTS.md, README.md, package.json, pnpm-lock.yaml, pnpm-workspace.yaml, .node-version, .env.example, .gitignore, все корневые настройки, .github/**; docs/contract.md, requirements.md, architecture.md, ownership.md, toolchain.md, integration.md, game-ui.md.
- Участник 2: src/data/**, src/lib/simulation/**, src/app/api/simulate/route.ts, tests/simulation/**, docs/simulation.md.
- Участник 3: src/lib/ai/**, src/features/results/**, src/app/api/analysis/route.ts, tests/ai/**, results/**, live-ai/**, docs/ai-analysis.md.

Остальное можно читать, но не изменять. На нулевом этапе Талгат создаёт стартовые файлы всех модулей, затем владение передаётся. Новые зависимости, общие типы/схемы и обновления fixtures меняет только координатор отдельной последовательной правкой после согласования. Укажи необходимость, предлагаемый формат и влияние. Модульные стили внутри своего каталога; глобальные только у Талгата.

## Проверки и ограничения

- Сохрани стек и версии. Установка: pnpm install --frozen-lockfile.
- Проверки: pnpm lint, pnpm typecheck, pnpm test, pnpm build; после build — pnpm test:e2e (нужен Chromium).
- pnpm test:ai-live запускает tests/live-ai/vitest.config.ts и требует настоящего ответа source=ai/status=ready. Нет настроек или получен fallback — live-проверка не пройдена. Он не входит в обычный CI.
- Обычные тесты и сборка работают без AI-ключа. E2E очищает AI_PROVIDER, AI_MODEL и AI_API_KEY для своего production-сервера; не превращай обычный прогон в вызов платного провайдера.
- Runtime не импортирует tests/fixtures. Не подгонять ожидаемые числа под реализацию.
- Единый каталог и расчёт. Не добавлять дубли, случайность или формулу в UI/AI.
- Секреты только на сервере в игнорируемом .env.local; не логировать, не коммитить, не использовать NEXT_PUBLIC.
- Следуй src/shared/ports.ts. Границы модулей и проверка объяснений — docs/architecture.md.
- Общие проверки tests/contracts/scaffold.test.ts и e2e должны отражать реальные подключённые модули. Не оставляй ожидания 501/NOT_IMPLEMENTED для готового API и не допускай одновременно заглушку и реализацию ради зелёного результата. Общие тесты типов/данных/ID сохраняются; fixtures не подгоняются.

## Git и отчёты

Параллельная разработка только после проверенного merge каркаса. Три ветки от одного SHA main, отдельные клоны/worktree. Существующие изолированные ветки Codex сохранять. Ветки: chore/scaffold, feat/game-ui, feat/simulation, feat/ai-analysis, затем feat/integration. На одном компьютере порты 3000/3001/3002.

Не push в main, не force push, не сбрасывать чужие изменения, не подменять автора коммита. При доступе публиковать свою ветку и draft PR. Merge подтверждает команда. Нет доступа — оставить проверенные локальные изменения и точный статус.

Итоговый отчёт: реализовано; файлы; реальные проверки; непроверенное и блокеры; ветка/commit/PR; собственная демонстрация.
