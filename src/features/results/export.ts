import type { AnalysisUiState, SimulationResult } from "@/shared/types";
import { aiAnalysisSchema } from "@/shared/schema";

// The container owns requests/revisions. Keep a stale explanation out of display/export as well.
export function matchingAnalysis(result: SimulationResult, state: AnalysisUiState) {
  if (state.status !== "ready") return null;
  const parsed = aiAnalysisSchema.safeParse(state.analysis);
  if (!parsed.success) return null;
  const analysis = parsed.data;
  const factIds = new Set(result.facts.map(fact => fact.id));
  const points = [analysis.summary, ...analysis.strengths, ...analysis.risks, ...analysis.tradeoffs, ...analysis.recommendations];
  return analysis.scenarioId === result.scenarioId
    && analysis.modelVersion === result.modelVersion
    && analysis.datasetVersion === result.datasetVersion
    && points.every(point => point.factIds.length > 0 && point.factIds.every(factId => factIds.has(factId))) ? analysis : null;
}

export function createResultsExport(result: SimulationResult, state: AnalysisUiState) {
  const analysis = matchingAnalysis(result, state);
  return {
    exportVersion: 1,
    synthetic: true,
    disclaimer: "Учебная модель условных районов. Score не является официальной оценкой Астаны.",
    simulation: result,
    analysis,
    analysisUiStatus: state.status === "ready" && !analysis ? "error" : state.status,
  };
}
