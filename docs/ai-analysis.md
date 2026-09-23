# Модуль участника 3

Провайдер/модель не выбраны. analyzeScenario возвращает NOT_IMPLEMENTED, POST /api/analysis — 501. Помощники выбрасывают ScaffoldNotImplementedError; пояснение в docs/architecture.md. ResultsPanel — placeholder.

Далее: серверный пересчёт запроса, объяснение проверенных facts, структурированный ответ, timeout 15000 мс, маркированный fallback, итоговый экран и экспорт. Ключ только на сервере. Обычные тесты без сети, отдельная live-проверка. test:ai-live сейчас честно завершится кодом 1; координатор подключит будущие tests/live-ai.
