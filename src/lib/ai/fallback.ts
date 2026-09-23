import "server-only";
import type { AnalysisPort } from "@/shared/ports";

/** Deterministic explanation of already verified facts; never labelled as AI. */
export const buildFallbackAnalysis: AnalysisPort["buildFallbackAnalysis"] = (result) => ({
  scenarioId: result.scenarioId, modelVersion: result.modelVersion, datasetVersion: result.datasetVersion,
  source: "fallback", status: "unavailable",
  summary: { text: "Резервное объяснение: итог и расходы взяты из проверенного расчёта. Это учебный сценарий на синтетических данных, а не прогноз для реальной Астаны.", factIds: ["score:after", "budget:spent"] },
  strengths: result.facts.filter(f => f.kind === "effect" && f.value > 0).slice(0, 3).map(f => ({ text: "Выбранное мероприятие вносит положительный вклад в указанный показатель. Итог района учитывает все мероприятия и ограничения шкалы.", factIds: [f.id] })),
  risks: [{ text: "Учебная оценка не учитывает все условия города. Эффекты каталога не подтверждают реальную эффективность мероприятий.", factIds: ["score:after"] }],
  tradeoffs: result.facts.filter(f => f.kind === "effect" && f.value < 0).slice(0, 3).map(f => ({ text: "У мероприятия есть отрицательный модельный вклад в другой показатель. Это условный компромисс каталога, а не доказанная городская причинность.", factIds: [f.id] })),
  recommendations: [{ text: "Сравните другой набор решений и его проверенные факты, сохраняя ограничение бюджета.", factIds: ["budget:spent"] }],
});
