# Контракт разработки «Аким на 5 часов»

Этот файл — согласованный проектный контракт для нулевого этапа и трёх отдельных сессий Codex. Он задаёт устройство MVP, владение файлами, интерфейсы и проверочные примеры. Это решения команды, а не дополнения к официальному ТТ.

## Проверенные исходные сведения

- Репозиторий: https://github.com/BAITC-Hacks/hack-12254b16-vip-polo . Приватный, основная ветка main.
- На момент проверки 23 сентября 2026 года локальная и удалённая main указывают на 994ae65ecac59068f7fac2bf278ab3673903a58a. В дереве только README.md. Локальных изменений нет. AGENTS.md в репозитории и проверенных родительских каталогах отсутствует.
- GitHub-коннектор сообщает pull=true, push=true, admin=false. Доступ других сессий и участников отдельно не проверен. Наличие push не гарантирует возможность обойти правила ветки.
- Доступное bundled-окружение: Node.js 24.19.0, pnpm 11.19.0. В обычном PATH команды node и npm отсутствовали. Нулевой этап должен настроить окружение своей сессии и документировать обычный запуск для других компьютеров.
- Исходный DOCX прочитан, включая таблицу критериев. Требования: одинаковые стартовые бюджет и данные; пять решений по пяти направлениям; контроль бюджета; AI-анализ; Astana Quality of Life Score; объяснение сильных сторон, рисков и последствий.
- В ТТ есть критерий изменения Score при изменении решений. Обязательная демонстрация сравнивает сценарии A и B ниже. Модель не обещает уникальный Score каждой возможной комбинации.
- В ТТ синтетический датасет допускается, но отдельный файл данных не предоставлен. Карта и визуализация — выбранные функции команды; визуализация в ТТ опциональна. README и воспроизводимость дают 25 из 100 баллов, ещё по 25 — соответствие задаче и техническая реализация; ценность 15, развитие/оригинальность 10.
- Название задачи не задаёт продолжительность хакатона или физическую скорость последствий. Точные бюджет, формула, веса и районы в ТТ не заданы.

## Архитектура и среда

Один Next.js-проект с App Router, TypeScript strict, React, CSS Modules и SVG-картой. JSON-данные, чистый расчётный модуль, два серверных POST-обработчика. Без базы данных, аккаунтов, мультиплеера, случайных событий и 3D.

Node.js 24.19.0 и pnpm 11.19.0 закрепить в .node-version и packageManager. Next.js, React, TypeScript, Zod, Vitest, Testing Library, jsdom, Playwright и ESLint установить совместимыми стабильными версиями на нулевом этапе, зафиксировать точные прямые версии и pnpm-lock.yaml, записать фактические версии в docs/toolchain.md. Не представлять неустановленные зависимости как проверенные. Не добавлять несколько менеджеров пакетов. Выбор AI-провайдера и его конкретной доступной модели фиксирует участник 3 по реальному доступу; настройка через серверные переменные окружения.

Нулевой этап создаёт scripts:
- pnpm dev — локальный запуск;
- pnpm lint — ESLint;
- pnpm typecheck — tsc --noEmit;
- pnpm test — vitest run;
- pnpm build — production-сборка;
- pnpm start — production-сервер;
- pnpm test:e2e — Playwright;
- pnpm test:ai-live — явная отдельная проверка живого AI, без включения в обычный CI.

После нулевого этапа установка только pnpm install --frozen-lockfile. Нулевой этап сначала генерирует lockfile обычной установкой. Отсутствие ключа не мешает сборке или обычным тестам.

## Рабочие допущения модели v1

budget=100; currencyLabel='условных единиц'; modelVersion='model-v1'; datasetVersion='synthetic-v1'; synthetic=true; horizonLabel='условный сценарий после реализации мероприятий'.

Порядок направлений: transport, greenery, social, safety, service. Все показатели — нормированные индексы качества 0..100, больше лучше. transport означает качество транспорта, а не исходную транспортную нагрузку; реальные исходные единицы не используются.

Районы, показатели в указанном порядке:
- north / «Северный»: 40, 65, 45, 55, 45;
- center / «Центральный»: 65, 35, 60, 40, 50;
- south / «Южный»: 45, 50, 45, 55, 55.

Это условные районы, не административная карта Астаны. Их веса равны 1/3, веса показателей равны 1/5. Начальный городской Score=50.

В каждом направлении три инициативы. ID: <direction>-basic, <direction>-standard, <direction>-premium. Стоимость/прибавка главного показателя/снижение следующего показателя в цикле:
- basic: 10 / +6 / -1;
- standard: 20 / +12 / -2;
- premium: 30 / +21 / -3.

Цикл компромиссов: transport -> greenery -> social -> safety -> service -> transport. Это условная механика баланса, а не утверждение о реальной причинности. Участник 2 даёт каждому мероприятию понятное название и объяснение именно модельного компромисса. Примеры тем: автобусное обслуживание, озеленение дворов, общественные пространства для социальных услуг, освещение пешеходных зон, обслуживание обращений жителей. Уровни — масштаб одного мероприятия.

Каждая инициатива применяется к одному выбранному району, доступна во всех трёх. Несколько направлений могут затронуть один район. Ровно одно мероприятие на направление в завершённом сценарии. В черновике допустимо 0..5 решений, но не более одного на направление. Пропуск направления не является финальным решением. Дополнительных межнаправленных запретов в v1 нет.

Для каждой пары район/метрика сначала суммировать эффекты всех выбранных инициатив, затем один раз ограничить значение диапазоном 0..100. Всегда считать от исходных данных. Сортировка ввода не меняет итог. В trace хранить начальное значение, каждый вклад, сырую сумму, итог и поправку ограничения. При отмене или замене пересчитать весь сценарий заново.

Score = сумма всех 15 конечных показателей / 15. Округлять только итоговый Score до двух знаков; внутренние средние хранить без промежуточного округления. Экономия бюджета не добавляет очки. Оценка учебная, не официальная оценка Астаны.

## Владение файлами после нулевого этапа

Участник 1, Талгат:
- src/app/page.tsx, src/app/layout.tsx, src/app/globals.css;
- src/features/game/**, public/city/**;
- src/shared/** — общий контракт, схемы границы API, интерфейсы портов;
- tests/contracts/**, tests/fixtures/**, tests/game/**, tests/e2e/**;
- AGENTS.md, README.md, package.json, pnpm-lock.yaml, .node-version, .env.example, .gitignore, все корневые настройки, .github/**;
- docs/contract.md, docs/architecture.md, docs/ownership.md, docs/toolchain.md, docs/requirements.md, docs/integration.md, docs/game-ui.md.

Участник 2:
- src/data/**;
- src/lib/simulation/**;
- src/app/api/simulate/route.ts;
- tests/simulation/**;
- docs/simulation.md.

Участник 3:
- src/lib/ai/**, src/features/results/**;
- src/app/api/analysis/route.ts;
- tests/ai/**, tests/results/**, tests/live-ai/**;
- docs/ai-analysis.md.

Остальные файлы для каждого участника доступны только для чтения. Потребность в новой зависимости или изменении контракта описать координатору с причиной, новым форматом и влиянием. Талгат вносит общую правку отдельным последовательным изменением; после проверки команда обновляет свои ветки. Никто не меняет чужой контракт молча. Модульные стили лежат внутри каталога модуля, глобальные меняет только участник 1.

На нулевом этапе Талгат может создать оговорённые стартовые файлы и заглушки всех модулей. После передачи владения их заменяют соответствующие участники. На финальной интеграции общие места исправляет Талгат; дефекты чужой логики возвращаются владельцу, существенные чужие реализации не переписываются без согласования.

## Минимальные типы src/shared/types.ts

```ts
export type Direction = 'transport' | 'greenery' | 'social' | 'safety' | 'service';
export type Metrics = Record<Direction, number>;
export type ValidationMode = 'draft' | 'final';

export interface District {
  id: string;
  name: string;
  baseline: Metrics;
}
export interface Effect {
  ruleId: string;
  metric: Direction;
  delta: number;
  explanation: string;
}
export interface Initiative {
  id: string;
  direction: Direction;
  title: string;
  description: string;
  cost: number;
  eligibleDistrictIds: string[];
  effects: Effect[];
}
export interface Decision {
  direction: Direction;
  districtId: string;
  initiativeId: string;
}
export interface ScenarioConfig {
  modelVersion: string;
  datasetVersion: string;
  synthetic: true;
  budget: number;
  currencyLabel: string;
  directions: Direction[];
  metricWeights: Metrics;
  districtWeights: Record<string, number>;
  bounds: { min: number; max: number };
  horizonLabel: string;
}
export interface GameData {
  config: ScenarioConfig;
  districts: District[];
  initiatives: Initiative[];
}
export interface ScenarioRequest {
  modelVersion: string;
  datasetVersion: string;
  decisions: Decision[];
}
export interface MetricTrace {
  districtId: string;
  metric: Direction;
  baseline: number;
  contributions: {
    initiativeId: string;
    ruleId: string;
    delta: number;
  }[];
  rawAfter: number;
  after: number;
  clampAdjustment: number;
}
export interface Fact {
  id: string;
  kind: 'budget' | 'score' | 'metric' | 'effect';
  label: string;
  value: number;
  unit: string;
  districtId?: string;
  initiativeId?: string;
  ruleId?: string;
}
export interface SimulationResult {
  scenarioId: string;
  modelVersion: string;
  datasetVersion: string;
  complete: boolean;
  decisions: Decision[];
  budget: { initial: number; spent: number; remaining: number };
  districts: { districtId: string; before: Metrics; after: Metrics }[];
  city: { before: Metrics; after: Metrics };
  score: { before: number; after: number; delta: number };
  trace: MetricTrace[];
  facts: Fact[];
  warnings: string[];
}
export type ErrorCode =
  | 'INVALID_REQUEST' | 'UNKNOWN_DISTRICT' | 'UNKNOWN_INITIATIVE'
  | 'DUPLICATE_DIRECTION' | 'DUPLICATE_INITIATIVE' | 'DIRECTION_MISMATCH'
  | 'INCOMPATIBLE_DECISION' | 'INCOMPLETE_SCENARIO' | 'BUDGET_EXCEEDED'
  | 'VERSION_MISMATCH' | 'PAYLOAD_TOO_LARGE' | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR';
export interface AppError {
  code: ErrorCode;
  message: string;
  field?: string;
  details?: Record<string, string | number | boolean>;
}
export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
export interface AnalysisPoint {
  text: string;
  factIds: string[];
}
export interface AIAnalysis {
  scenarioId: string;
  modelVersion: string;
  datasetVersion: string;
  source: 'ai' | 'fallback';
  status: 'ready' | 'unavailable' | 'timeout' | 'invalid_response';
  summary: AnalysisPoint;
  strengths: AnalysisPoint[];
  risks: AnalysisPoint[];
  tradeoffs: AnalysisPoint[];
  recommendations: AnalysisPoint[];
  providerModel?: string;
}
export interface AnalysisResponse {
  simulation: SimulationResult;
  analysis: AIAnalysis;
}
export type AnalysisUiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; analysis: AIAnalysis }
  | { status: 'error'; message: string };
```

src/shared/schema.ts содержит строгие runtime-схемы запроса/ответа. Неизвестные поля запроса отклонять. TypeScript сам по себе не валидирует JSON. Не принимать от клиента стоимость, бюджет, коэффициенты, Score или готовые факты.

## Экспорты и соединения

Чистые синхронные экспорты src/lib/simulation/index.ts, владелец 2:

```ts
getGameData(): GameData;
validateScenario(input: unknown, data: GameData, mode: ValidationMode): Outcome<ScenarioRequest>;
simulateScenario(request: ScenarioRequest, data: GameData, mode: ValidationMode): Outcome<SimulationResult>;
```

simulateScenario повторно валидирует запрос, а не предполагает вызов validateScenario. Данные возвращать копией или замораживать, не допускать мутацию baseline. Модуль не импортирует React, серверные ключи или Node-only API, чтобы один расчёт работал в браузере и сервере.

Экспорт src/shared/scenario-id.ts, владелец 1:

```ts
makeScenarioId(request: ScenarioRequest): string;
```

ID = JSON.stringify([modelVersion,datasetVersion,sortedDecisions]), где sortedDecisions — массив троек [direction,districtId,initiativeId], отсортированных в фиксированном порядке направлений. Это канонический ключ, не криптографическая подпись и не подтверждение доверия. Перестановка решений не меняет ID. Любая правка каталога, исходных чисел или формулы требует соответствующего повышения версии. При изменении UI дополнительно повышать локальную ревизию запроса: даже возврат к тому же сценарию не должен принимать отменённый старый ответ.

Серверные экспорты src/lib/ai/index.ts, владелец 3:

```ts
analyzeScenario(input: unknown): Promise<Outcome<AnalysisResponse>>;
buildAnalysisFacts(result: SimulationResult, data: GameData): Fact[];
buildFallbackAnalysis(result: SimulationResult): AIAnalysis;
```

analyzeScenario получает исходные идентификаторы, вызывает getGameData и simulateScenario(...,'final') на сервере. Только проверенный результат попадает провайдеру. buildAnalysisFacts сверяет факты с trace и каталогом; не принимает browser facts. Серверные модули помечаются server-only.

Компоненты:
- GameShell({data: GameData}) — владелец 1, состояние игры и сетевые запросы;
- CityMap({districts: District[], selectedDistrictId: string | null, preview: SimulationResult | null, onSelectDistrict: (id: string) => void}) — владелец 1;
- InitiativePicker({initiatives: Initiative[], direction: Direction, districtId: string, selectedInitiativeId: string | null, remainingBudget: number, onSelect: (initiativeId: string) => void, onRemove: () => void}) — владелец 1; бюджет замены проверяется через общий расчёт и callback контейнера;
- ResultsPanel({result: SimulationResult, analysisState: AnalysisUiState, onRetryAnalysis: () => void, onReplay: () => void, onEdit: () => void}) — владелец 3. Сама панель не делает fetch и не импортирует серверный AI.

API, общие форматы Outcome<T>:
- POST /api/simulate, body ScenarioRequest -> Outcome<SimulationResult>;
- POST /api/analysis, body тот же ScenarioRequest -> Outcome<AnalysisResponse>.

Оба маршрута работают только в final-режиме. Черновой preview в браузере использует simulateScenario(...,'draft') без запроса к AI. Модель бюджета одна и та же. Данные для GameShell передаются серверной страницей из getGameData.

HTTP: 200 успех (включая честно маркированный fallback AI), 400 плохой JSON/форма запроса, 409 несовпадение версии, 422 неверный сценарий/бюджет, 413 тело более 16 KiB, 501 стартовая заглушка, 500 неожиданная ошибка без секретов и stack trace. Конкретный code берётся из AppError.

В AIAnalysis source='ai' только с status='ready' после настоящего валидного ответа. Fallback: source='fallback' и status='unavailable'|'timeout'|'invalid_response'. Отсутствующий ключ/ошибка провайдера/неподдержанная конфигурация дают unavailable. Один серверный вызов ограничен AI_TIMEOUT_MS (по умолчанию 15000), без бесконечных повторов. Повтор — явная кнопка пользователя.

Модель AI и серверные настройки: AI_PROVIDER, AI_MODEL, AI_API_KEY, AI_TIMEOUT_MS. Участник 3 выбирает и документирует один реально доступный провайдер; название модели не угадывать. Никаких NEXT_PUBLIC ключей. Если ключ/модель не предоставлены, реализовать адаптер и fallback, а live-проверку честно оставить блокером полной готовности. Не логировать секреты.

AI получает числа, выбранные инициативы и модельные оговорки, возвращает только структуру объяснений. Не возвращает новую оценку. Каждый содержательный пункт ссылается на существующие factIds. Числовые подписи фактов и before/after отображаются из SimulationResult, не из AI-текста. Runtime-проверка ограничивает длину/число пунктов и проверяет ссылки; инструкция запрещает выдумывать городские факты. Проверка схемы не доказывает смысловую истинность текста, поэтому реальные ответы дополнительно просматривают при live-демонстрации. Рекомендации — необязательный короткий раздел, без обещаний реальной эффективности.

GameShell завершает сценарий через /api/simulate, сразу показывает результат, затем один раз вызывает /api/analysis. На изменение решения очищает результат/анализ, прерывает старый запрос и повышает revision. Ответ принимается только при совпадении revision, scenarioId и версий. При отказе AI результат остаётся доступен, повторный запрос не теряет его. ResultsPanel позволяет скачать проверенный результат и доступное объяснение JSON-файлом; база данных для MVP не нужна.

## Общие проверочные примеры

tests/fixtures — только тестовые константы, не runtime-источник данных. В них сохранить полные запросы и независимо рассчитанные ожидаемые ответы. Runtime-данные лежат только в src/data.

Пример запроса A:

```json
{
  "modelVersion": "model-v1",
  "datasetVersion": "synthetic-v1",
  "decisions": [
    {"direction":"transport","districtId":"north","initiativeId":"transport-basic"},
    {"direction":"greenery","districtId":"north","initiativeId":"greenery-basic"},
    {"direction":"social","districtId":"north","initiativeId":"social-basic"},
    {"direction":"safety","districtId":"north","initiativeId":"safety-basic"},
    {"direction":"service","districtId":"north","initiativeId":"service-basic"}
  ]
}
```

- A: пять basic в north. Расход 50, остаток 50; north после [45,70,50,60,50]; другие районы без изменений; Score 51.67, delta 1.67.
- B: в A заменить transport-basic на transport-premium. Расход 70, остаток 30; north после [60,68,50,60,50]; Score 52.53, delta 2.53.
- C: пять standard в north. Расход ровно 100, остаток 0; north после [50,75,55,65,55]; Score 53.33, delta 3.33.
- D: пять premium, расход 150 -> BUDGET_EXCEEDED, HTTP 422, результата и AI-запроса нет.
- E: A без service, четыре решения -> draft допустим, spent=40, complete=false; final -> INCOMPLETE_SCENARIO.
- Замена B обратно на A полностью восстанавливает A. Удаление и возврат решения дают те же числа; исходный dataset не мутируется.
- Перестановка массива A сохраняет результат и scenarioId.
- Неизвестный districtId/initiativeId, дубли направлений/инициатив, несовпадающее direction, неподходящий район, дополнительные поля cost/score, неверный JSON и устаревшая версия отклоняются.
- Для проверки clamp отдельные явно тестовые GameData дают значения 99 и 1: проверить верхний/нижний предел, суммирование до clamp и trace.clampAdjustment. Не менять production baseline ради теста.
- AI fixtures: валидный source=ai, fallback без ключа, timeout, плохой JSON, неизвестный factId, лишняя/подменённая оценка, устаревший ответ. Не выдавать fixture за live-ответ.

## Нулевой этап и заглушки

Один Codex под управлением участника 1 создаёт запускаемый каркас, этот контракт в docs/contract.md, требования в docs/requirements.md, распределение в AGENTS.md/docs/ownership.md, общие типы/runtime-схемы/ports, makeScenarioId и тесты его канонизации, test fixtures и настройки проверок.

Он может внести согласованные JSON-исходники из этого файла как стартовые данные, без реализации формулы/валидатора за участника 2. Участник 2 принимает владение данными, реализует и проверяет модель, описывает каталог.

В src/lib/simulation/index.ts на старте getGameData читает JSON, validateScenario/simulateScenario возвращают NOT_IMPLEMENTED. В src/lib/ai/index.ts стартовые экспорты также явно сообщают NOT_IMPLEMENTED. Стартовые API возвращают 501. Result/Game-компоненты существуют как типизированные placeholders. Демо не должно изображать завершённую игру. Test fixtures подключать только в тестах. После завершения модулей в production-пути не должно быть NOT_IMPLEMENTED или фиктивных ответов.

Полные тесты будущей модели не запускать как заведомо падающие на каркасе. Нулевой этап проверяет контракт/данные/канонизацию ID и загрузку страницы; участники добавляют проверки своих реализаций. Не выключать уже существующие тесты и не подгонять ожидаемые числа под реализацию.

## GitHub и порядок работы

1. Ветка chore/scaffold либо уже выделенная изолированная ветка Codex. Прочитать существующие AGENTS.md, проверить статус, remote и ветку. Не затрагивать чужую рабочую сессию.
2. Реализовать каркас и проверки. Создать draft PR при доступе. Команда проверяет и подтверждает merge; Codex не сливает автоматически.
3. После merge все трое начинают от одного зафиксированного SHA main, который включает каркас. Текущий initial commit не является этим будущим SHA.
4. Изолированные клоны или worktree: feat/game-ui, feat/simulation, feat/ai-analysis. Существующие управляемые ветки Codex сохранять. Три чата в одном каталоге не обеспечивают изоляцию. На одном компьютере dev-порты 3000/3001/3002.
5. Модули разрабатываются параллельно на типах и fixtures. Общие интерфейсы меняет только координатор, последовательно. Не импортировать fixtures в рабочее приложение.
6. Каждый участник проверяет свой модуль и создаёт отдельный draft PR с изменениями, тестами и демонстрацией вклада. Команда рассматривает модель первой, затем UI, затем AI/results; оставшиеся ветки обновляются обычным merge актуальной main без force push.
7. После подтверждённых merge Талгат создаёт feat/integration от актуальной main. Подключает компоненты, проверяет полный цикл, возвращает дефекты владельцам, обновляет README и демонстрационный сценарий.
8. Окончательное объединение также подтверждает команда. Не делать push прямо в main, force push, сброс/удаление чужих изменений, выдуманное авторство или отключение тестов.

Push и создание PR выполнять только при доступе конкретной сессии. При отсутствии доступа оставить проверенные локальные изменения и точный статус. GitHub не заменяет среду исполнения: публикация файлов коннектором сама по себе не подтверждает сборку. Локальные файловые разрешения запрашивать только при фактической необходимости, не обходить ограничения. Чужие секреты не запрашивать и не копировать.

## Готовность и отчёты

Каждый итоговый отчёт: реализовано; изменённые файлы; фактически выполненные команды и результаты; что не проверено; блокеры; ветка/commit/PR при наличии; личная демонстрация участника. Не приписывать тестам успех без запуска.

Финальный gate: запуск по README на чистой установке, lint/typecheck/unit/build/e2e, одинаковые стартовые данные, пять решений, замена/отмена/повтор, бюджет через UI и прямой POST, сценарии A/B с разными Score, trace, настоящий AI при доступе, timeout/fallback/retry/stale response, отсутствие секретов и runtime-заглушек, собственный показ каждого участника.

Полная готовность невозможна без успешной live-проверки AI. При отсутствии доступа основная игра и fallback могут быть готовы, но этот блокер остаётся явно указанным.
