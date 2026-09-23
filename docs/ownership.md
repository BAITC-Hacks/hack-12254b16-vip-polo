# Владение

Полное распределение из контракта перенесено в AGENTS.md. Для каждой сессии остальные области доступны только для чтения.

| Владелец | Файлы |
|---|---|
| 1, Талгат | features/game, public/city, общая страница/layout/styles, src/shared, tests/contracts/fixtures/game/e2e/support, tests/setup.ts, scripts, корневые настройки/зависимости/lockfile/README/AGENTS, .github |
| 1, документация | contract, requirements, architecture, ownership, toolchain, integration, game-ui |
| 2 | src/data, lib/simulation, api/simulate, tests/simulation, docs/simulation.md |
| 3 | lib/ai, features/results, api/analysis, tests/ai/results/live-ai, docs/ai-analysis.md |

Нулевой этап разрешает Талгату создать стартовые файлы всех модулей, затем они передаются владельцам. Общую правку запрашивать с причиной, форматом и влиянием; координатор вносит её последовательно. Не устанавливать зависимость и не менять контракт молча.

При замене заглушек координатор обновляет соответствующие тесты каркаса одновременно с PR модуля. Участник 3 пишет будущие tests/live-ai; Талгат меняет scripts/ai-live.mjs на их запуск. Проверки сохраняются, а временные ожидания заменяются реальными.

Каждый участник пишет свои тесты/документацию, готовит отдельный PR и показывает реальный вклад. Разные чаты в одной папке не являются изоляцией.
