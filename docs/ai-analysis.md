# AI-анализ и ResultsPanel — участник 3

## Состояние и границы готовности

Работа выполнена в отдельном клоне на `feat/ai-analysis`, от main
`1127f02554ea2239f5ef680b36035767fe5efb70`. До начала работы AI-ветки/PR не существовало,
в модуле были только переданные участнику 3 заглушки. Родительских AGENTS.md нет;
действующие AGENTS.md, contract.md целиком, ownership, architecture, toolchain прочитаны.

На проверке 23 сентября 2026:

- [PR #2](https://github.com/BAITC-Hacks/hack-12254b16-vip-polo/pull/2),
  `feat/simulation`, `056c43031ee0c86d969dd6c12f68a8c147e8b636`: open/draft, не merged.
- [PR #3](https://github.com/BAITC-Hacks/hack-12254b16-vip-polo/pull/3),
  `feat/game-ui`, `5fd66331fe20e51f8ecd9fb3d72ecc942d7ed9c1`: open/draft, не merged.

AI и панель реализованы, но полное игровое соединение пока не проверено: main содержит
заглушки модели и GameShell. Допустимый запрос анализа честно получает ошибку модели
NOT_IMPLEMENTED/501; fallback с выдуманным расчётом приложение не возвращает.
Моки/fixtures используются исключительно тестами. Чужие PR не объединялись.

Настоящий AI **не проверен**. В этой сессии нет `.env.local`, AI_API_KEY, AI_MODEL или
AI_PROVIDER. Доступ к API-модели не следует из доступа к Codex/GitHub. Реализован один
адаптер OpenAI Responses API; модель без подтверждённого доступа не выбрана по умолчанию.

## Реализация

- `src/lib/ai/index.ts`: строгий исходный ScenarioRequest, серверные getGameData и
  simulateScenario(request, data, 'final'), проверка идентичности результата,
  факты, единственный запрос провайдеру. Неверный сценарий не вызывает AI.
- `src/lib/ai/facts.ts`: проверяет версии, полноту, ID, выбранный каталог, бюджет,
  полноту/уникальность районов, trace и facts. Сверяет baseline/after, вклады с
  выбранными effect/ruleId, rawAfter/clampAdjustment и значения/метаданные facts.
  Возвращает отдельную копию. Не вычисляет новый городской Score: score:after
  сверяется с авторитетным result.score.after, рассчитанным серверным движком.
- `src/lib/ai/provider.ts`: серверный OpenAI Responses API через встроенный fetch,
  без новой зависимости. Фиксированный HTTPS endpoint, redirect:error, store:false,
  один запрос без retry. Ограничение ответа 64 KiB, строгий UTF-8. Проверяет
  completed/assistant/output_text; refusal/incomplete/неоднозначный ответ отвергает.
- `src/lib/ai/explanation.ts`: строгая Zod-схема используется и для JSON Schema
  провайдера, и для runtime-проверки. Сценарий, версии, source/status задаёт сервер,
  провайдер возвращает только объяснение. Все поля обязательны: summary,
  strengths/risks/tradeoffs по 1–4 пункта, recommendations 0–2. Текст 20–600 символов,
  1–6 уникальных существующих factIds. Лишние поля, в том числе score, запрещены.
  Цифровые значения в тексте запрещены: числа отображаются отдельно из facts.
- `src/lib/ai/fallback.ts`: детерминированное объяснение проверенных фактов,
  всегда source=fallback. Вклады эффектов не называются итоговым изменением района.
- `src/app/api/analysis/route.ts`: реальные потоковые байты запроса до 16 KiB,
  включая chunked/multibyte и ложный Content-Length; строгая форма запроса/ответа,
  безопасные фиксированные сообщения ошибок, no-store. Успех/fallback 200,
  INVALID_REQUEST 400, VERSION_MISMATCH 409, неверный сценарий 422, размер 413,
  ошибка 500. Пока модель — заглушка, её NOT_IMPLEMENTED сохраняет 501.
- `src/features/results/ResultsPanel.tsx`, `results.module.css`, `export.ts`:
  исходные props из ports.ts, Score до/после/delta, бюджет, районные показатели,
  факты и ссылки из объяснений. Все числа из SimulationResult. Нет fetch или
  импорта серверного AI. Idle/loading/error/ready, три причины fallback,
  callbacks retry/edit/replay, JSON-экспорт с simulation/trace/facts/analysis,
  маркировкой synthetic/source/status. Несовпадающий сценарий/версии не показываются
  и не попадают в экспорт. Responsive, таблицы с caption/scope, focus-visible,
  live-статусы, управление клавиатурой. Названия районов отсутствуют в props,
  поэтому показаны их ID без второго каталога.

Схема и запрет цифр не доказывают смысловую истинность свободного текста.
Например, число словами и необоснованная причинность требуют ручной оценки.
Live-демонстрация должна проверить соответствие содержания ссылкам и модельным оговоркам.

## Провайдер и серверная настройка

Официальные страницы проверены 23 сентября 2026:
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
описывает Responses `text.format` с json_schema/strict;
[GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
документирует Structured Outputs и snapshot `gpt-4.1-mini-2025-04-14`.
Это документированный кандидат для проверки аккаунта, **не подтверждённая доступная модель**.
AI_MODEL обязателен; автоматической подстановки имени модели нет.

Владелец серверного доступа заполняет только игнорируемый `.env.local`:

```dotenv
AI_PROVIDER=openai
AI_MODEL=
AI_API_KEY=
AI_TIMEOUT_MS=15000
```

Пустые поля заполняются локально доступной моделью и ключом. Не отправлять ключ в чат,
не добавлять NEXT_PUBLIC, Git, логи или скриншоты. `.gitignore` уже игнорирует `.env.local`;
`git check-ignore .env.local` проверен. `.env.example` и зависимости не изменялись.

AI_TIMEOUT_MS по умолчанию 15000, допустимый целый диапазон 1–60000 мс.
Неверная/неподдержанная конфигурация, отсутствие ключа, HTTP/сетевая ошибка:
fallback/unavailable. Дедлайн охватывает fetch и чтение тела, прерывает запрос/reader:
fallback/timeout. Невалидное тело/JSON/схема/factIds/дополнительная оценка:
fallback/invalid_response. Только успешный прошедший проверку ответ: ai/ready.
Ошибки провайдера/ключи/stack trace не возвращаются и не логируются.

## Совместимость с PR #2 и #3

Статически прочитаны фактические simulation, GameShell и useGame указанных SHA.
SimulationPort и ResultsPanelProps менять не требуется. Идентификаторы facts
совпадают: budget:spent, score:after, district:<id>:<metric>:after,
effect:<initiative>:<district>:<metric>. Проверки A/B/C используют независимые
общие fixtures только в tests. Score не дублируется в AI; в частности, delta
движка может быть округлённой разностью неокруглённых средних.

useGame уже запрашивает simulation, показывает его до AI, делает retry,
проверяет сценарий/версии/revision и отменяет старые запросы. Fallback приходит
внешним AnalysisUiState.status='ready', с analysis.source='fallback'. Панель
обрабатывает именно этот контракт, а не выдуманный внешний status='fallback'.

После подтверждённого командой merge модели: `git fetch origin`, затем обычный
`git merge origin/main` в этой ветке, без rebase/force push; повторить проверки
на реальном соединении. Не подключать fixture или копию движка PR #2 в runtime.
После merge UI выполнить полный игровой цикл и браузерные проверки.

## Фактические проверки

Windows; bundled Node.js **24.19.0**, pnpm **11.19.0**. Системный Node 24.13.0
обнаружен, но для проверок PATH переключён на закреплённый bundled Node.
Git и GitHub-коннектор доступны, gh отсутствует. Установка:
`pnpm install --frozen-lockfile` — успешно; package.json/lockfile неизменны.

- `pnpm lint` — успешно.
- `pnpm typecheck` — успешно.
- `pnpm test tests/ai tests/results` — **123/123** (70 AI, 37 route, 16 panel).
- Полный `pnpm test` — **133 passed, 1 failed**: устаревший тест каркаса падает на ожидании исключения
  ScaffoldNotImplementedError от уже реализованного buildAnalysisFacts.
  Общий тест сохранён, не отключён.
- `pnpm build` — успешно, реальные Next production-маршруты собраны.
- `pnpm test:e2e` с установленным Chromium — страница 1 passed, API-тест
  1 failed: старое ожидание analysis({})=501, фактически корректный HTTP 400.
  Первая попытка без Chromium была неуспешной; после установки браузер проверен.
- Панель на тестовом рендере 1280/360 px: скриншоты просмотрены, горизонтального
  переполнения нет. Это визуальная проверка панели, не соединённой игры.
- `git diff --check` — успешно.
- Отдельный live runner запущен: **exit 1**, "Live AI не проверен: нужны серверные
  AI_PROVIDER=openai, AI_MODEL и AI_API_KEY". Сетевого вызова не было, настоящего
  ответа нет. Тест не skip и fallback не засчитывается как успех.

Обычные AI-тесты всегда заменяют fetch тестовым ответом и не требуют сети/ключа.
Покрыты: серверный final, запрет клиентских score/budget/facts/cost, отсутствие
провайдера при неверном сценарии, валидный mock-ответ, конфигурация без ключа,
HTTP/сеть, стандартный/настраиваемый таймаут и зависшее тело, отказ/неполный ответ,
плохой JSON, лишняя/подменённая оценка, неизвестные/дублирующиеся factIds,
размеры, trace/catalog/facts tampering, все состояния панели, callbacks и экспорт.
Тестовый source=ai проверяет протокол и никогда не называется live-ответом.

## Точные действия Талгата (чужие файлы не изменены)

1. `tests/contracts/scaffold.test.ts`: заменить строки 17–18 на
   `expect(buildAnalysisFacts(result,data)).toEqual(result.facts)` и проверку
   `buildFallbackAnalysis(result)` на source=fallback/status=unavailable,
   общий aiAnalysisSchema и существующие factIds. После merge #2 строки 12–14
   должны проверять успешные validate/simulate A, полное совпадение с expected;
   analyzeScenario(A) без ключа — simulation=A, fallback/unavailable.
2. Там же разделить API-цикл 19–21: создавать Request с JSON. analysis({}) →
   400/INVALID_REQUEST; после merge #2 A → 200/Outcome с fallback без ключа,
   D → 422/BUDGET_EXCEEDED, E → 422/INCOMPLETE_SCENARIO. Для simulate аналогичные
   проверки модели. До merge #2 допустимый A по-прежнему 501/NOT_IMPLEMENTED.
3. `tests/e2e/scaffold.spec.ts`: заменить общий 501 на отдельные simulate/analysis
   A/200, D/422, {}/400; analysis без ключа должен явно иметь fallback/unavailable.
   `tests/contracts/page.test.tsx` и UI e2e после интеграции больше не должны
   ожидать текст о недоступном полном прохождении; проверить preview/завершение.
4. PR #3 `GameShell.tsx:62–64`: удалить внешние повторяющиеся кнопки
   «Редактировать решения»/«Повторить AI-анализ» и дублирующий live-status вокруг
   ResultsPanel. Сохранить useGame и props/callbacks. Иначе будут дубли UI и
   неоднозначные getByRole в tests/game/useGame.test.tsx.
5. PR #2 переименовал инициативы, PR #3 тесты всё ещё ищут «базовый масштаб» и
   «расширенный масштаб». Обновить tests/game/interface.test.tsx (28/34/37–46),
   useGame.test.tsx (162/180), tests/e2e/scaffold.spec.ts (13/17/19): unit-селекторы
   брать title из getGameData по initiativeId, e2e — действующие названия
   «точечная программа»/«расширенная районная программа» или устойчивые атрибуты.
6. Заменить принадлежащий координатору `scripts/ai-live.mjs` следующим запуском:

   ```js
   import { spawnSync } from "node:child_process";
   const result = spawnSync(process.execPath, [
     "node_modules/vitest/vitest.mjs", "run", "--config", "tests/live-ai/vitest.config.ts"
   ], { stdio: "inherit" });
   process.exit(result.status ?? 1);
   ```

   После этой замены `pnpm test:ai-live` запускает настоящий тест. Прямая команда:
   `pnpm exec vitest run --config tests/live-ai/vitest.config.ts`.
   Отдельный config обязателен: корневой исключает tests/live-ai.
   Локальный pnpm exec не находил vitest, поэтому проверено эквивалентной командой
   `.\node_modules\.bin\vitest.CMD run --config tests/live-ai/vitest.config.ts`.
   Config читает существующий .env.local без вывода его значений. Тест строит
   сценарий из реального каталога и требует именно ai/ready, без mocks/fixtures.
7. Подтвердить доступ к модели и выполнить live-тест после интеграции #2.
   Проверить реальный текст вручную, повтор, stale response, A/B и экспорт.
   Восстановить GitHub Actions при инфраструктурном отказе; локальные проверки
   не заменяют успешный CI. Автоматическое объединение этого PR не включать.

Новых зависимостей, правок shared-контракта или fixtures не требуется.

## Демонстрация после интеграции

1. `pnpm install --frozen-lockfile`, затем проверки, `pnpm build` и
   `pnpm start --hostname 127.0.0.1 --port 3002`.
2. **Fallback:** без AI_API_KEY выбрать пять basic в north и завершить. Расчёт
   появляется сразу: Score 50 → 51.67, потрачено 50, осталось 50. После анализа
   видна маркировка «Fallback · без AI», причина unavailable и ссылки на facts.
3. **AI:** локально заполнить .env.local подтверждённой моделью/ключом,
   перезапустить сервер, выполнить отдельный live-тест. Завершить A: только при
   настоящем валидном ответе маркировка «AI-анализ», source=ai/status=ready.
   Сравнить текст с factIds; цифры карточек должны остаться теми же.
4. **Повтор:** нажать «Повторить AI-анализ». Во время loading Score и экспорт
   доступны, кнопка повтора отключена. Повтор делегируется useGame.
   Для искусственного таймаута допустима локальная AI_TIMEOUT_MS=1 при реальном
   ключе и перезапуске, затем вернуть 15000; это проверка timeout, не AI-успех.
5. **Редактирование:** поменять transport-basic на transport-premium,
   завершить B: Score 52.53, потрачено 70, осталось 30. Старое объяснение не
   должно остаться. «Новая игра» очищает сценарий через callback.
6. **Экспорт:** «Скачать JSON» работает также при loading/error. В файле
   simulation с бюджетом/Score/trace/facts, доступный analysis со source/status,
   synthetic=true и оговорка учебной модели. Без объяснения analysis=null.

До объединения #2/#3 эту демонстрацию нельзя выдавать за пройденное игровое соединение.
