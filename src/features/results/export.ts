import type { AnalysisUiState, SimulationResult } from "@/shared/types";

// The container owns requests/revisions. Keep a stale explanation out of display/export as well.
export function matchingAnalysis(result: SimulationResult, state: AnalysisUiState) {
  if (state.status !== "ready") return null;
  const analysis = state.analysis;
  return analysis.scenarioId === result.scenarioId
    && analysis.modelVersion === result.modelVersion
    && analysis.datasetVersion === result.datasetVersion ? analysis : null;
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
