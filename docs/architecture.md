# Архитектура

Next.js App Router. Серверная page.tsx получает копию JSON через getGameData и передаёт GameShell. Чистый simulation в будущем работает и в браузере, и на сервере. AI помечен server-only. CSS Modules внутри модулей; SVG-карта появится у участника 1.

```text
JSON -> getGameData -> page -> GameShell
GameShell -> preview: simulateScenario(draft)
GameShell -> /api/simulate -> simulateScenario(final) -> ResultsPanel
GameShell -> /api/analysis -> simulateScenario(final) -> AI -> ResultsPanel
```

Расчётные/AI-стрелки — будущие соединения. Сейчас getGameData работает, расчётные экспорты возвращают NOT_IMPLEMENTED, API — 501. Компоненты карты, выбора и результатов — placeholders.

Типы: src/shared/types.ts; runtime-схемы: schema.ts; сигнатуры модулей и props: ports.ts. Схемы проверяют форму JSON и source/status AI. Бизнес-правила проверит участник 2. Существование factIds и смысловую корректность AI проверит участник 3.

## Временное поведение AI-помощников

analyzeScenario возвращает Outcome с NOT_IMPLEMENTED. buildAnalysisFacts по контракту возвращает Fact[], а buildFallbackAnalysis — AIAnalysis; вернуть Outcome без изменения сигнатуры невозможно. Поэтому оба сейчас выбрасывают ScaffoldNotImplementedError с code=NOT_IMPLEMENTED. Страница/API их не вызывают. Участник 3 заменит их реальными реализациями по тем же сигнатурам.

makeScenarioId строит JSON из версий и отсортированных троек решений, не меняя ввод. Для одинаковых направлений применяется строковый tie-break. Это не бизнес-валидация и не криптографическое доказательство. UI в дальнейшем также отслеживает revision и отмену запросов.

## Fixtures

Статические A–E содержат полные ожидаемые показатели, trace и facts. Runtime их не импортирует (контролируется ESLint). Тесты проверяют согласованность ожидаемых данных, а не работу ещё отсутствующего движка.

Порядок trace: north/center/south, затем порядок направлений; contributions в порядке направлений решений. Идентификаторы facts: budget:spent, score:after, district:<districtId>:<metric>:after, effect:<initiativeId>:<districtId>:<metric>. Это конвенция стартового набора. Изменения координатор синхронизирует с fixtures. Подписи не использовать как ID.

Vitest заменяет только marker server-only тестовым пустым модулем. Next.js в production использует настоящий marker и запрещает клиентский импорт AI.
