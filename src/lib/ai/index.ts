import "server-only";
import { notImplemented, ScaffoldNotImplementedError } from "@/shared/not-implemented";
import type { AnalysisPort } from "@/shared/ports";

export const analyzeScenario: AnalysisPort["analyzeScenario"] = async () => notImplemented("AI-анализ");
// These signatures return values, not Outcome: fail explicitly instead of inventing facts.
export const buildAnalysisFacts: AnalysisPort["buildAnalysisFacts"] = () => { throw new ScaffoldNotImplementedError("Факты для AI"); };
export const buildFallbackAnalysis: AnalysisPort["buildFallbackAnalysis"] = () => { throw new ScaffoldNotImplementedError("Резервное объяснение"); };
