import "server-only";
import { getGameData, simulateScenario } from "@/lib/simulation";
import { scenarioRequestSchema } from "@/shared/schema";
import { makeScenarioId } from "@/shared/scenario-id";
import type { AnalysisPort } from "@/shared/ports";
import { buildAnalysisFacts } from "./facts";
import { buildFallbackAnalysis } from "./fallback";
import { requestExplanation } from "./provider";

export { buildAnalysisFacts, buildFallbackAnalysis };

export const analyzeScenario: AnalysisPort["analyzeScenario"] = async (input) => {
  const parsed = scenarioRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "INVALID_REQUEST", message: "Некорректный запрос анализа." } };
  try {
    const data = getGameData();
    const outcome = simulateScenario(parsed.data, data, "final");
    if (!outcome.ok) return outcome;
    const result = outcome.data;
    if (result.scenarioId !== makeScenarioId(parsed.data)) throw new Error("Scenario mismatch");
    const facts = buildAnalysisFacts(result, data);
    const explanation = await requestExplanation(result, data, facts);
    const analysis = explanation.ok
      ? { ...explanation.content, scenarioId: result.scenarioId, modelVersion: result.modelVersion,
        datasetVersion: result.datasetVersion, source: "ai" as const, status: "ready" as const,
        providerModel: explanation.providerModel }
      : { ...buildFallbackAnalysis(result), status: explanation.status };
    return { ok: true, data: { simulation: result, analysis } };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Не удалось проверить результат анализа." } };
  }
};
