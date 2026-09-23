import { expect, it } from "vitest";
import { analyzeScenario, buildAnalysisFacts } from "@/lib/ai";
import { getGameData, simulateScenario } from "@/lib/simulation";
import { analysisOutcomeSchema } from "@/shared/schema";
import type { ScenarioRequest } from "@/shared/types";

it("receives a genuine provider explanation for the real final simulation", async () => {
  if (process.env.AI_PROVIDER?.trim() !== "openai" || !process.env.AI_MODEL?.trim() || !process.env.AI_API_KEY?.trim()) {
    throw new Error("Live AI не проверен: нужны серверные AI_PROVIDER=openai, AI_MODEL и AI_API_KEY.");
  }

  const data = getGameData();
  const district = data.districts[0];
  if (!district) throw new Error("Live AI не проверен: каталог районов пуст.");
  const request: ScenarioRequest = {
    modelVersion: data.config.modelVersion,
    datasetVersion: data.config.datasetVersion,
    decisions: data.config.directions.map(direction => {
      const initiative = data.initiatives.find(item => item.id === `${direction}-basic`
        && item.direction === direction && item.eligibleDistrictIds.includes(district.id));
      if (!initiative) throw new Error("Live AI не проверен: в реальном каталоге отсутствует базовое мероприятие.");
      return { direction, districtId: district.id, initiativeId: initiative.id };
    }),
  };

  // Both calls use the real model. No fixture, provider stub, or fabricated success is allowed.
  const calculated = simulateScenario(request, data, "final");
  if (!calculated.ok) {
    throw new Error(`Live AI не проверен: реальная модель вернула ${calculated.error.code}.`);
  }
  const outcome = await analyzeScenario(request);
  if (!outcome.ok) throw new Error(`Live AI не проверен: анализ вернул ${outcome.error.code}.`);
  expect(analysisOutcomeSchema.safeParse(outcome).success).toBe(true);
  const { simulation, analysis } = outcome.data;
  expect(simulation).toEqual(calculated.data);
  if (analysis.source !== "ai" || analysis.status !== "ready") {
    throw new Error(`Live AI не проверен: получен ${analysis.source}/${analysis.status}.`);
  }
  expect(analysis.providerModel).toBe(`openai/${process.env.AI_MODEL?.trim()}`);
  expect(analysis.scenarioId).toBe(simulation.scenarioId);
  expect(analysis.modelVersion).toBe(request.modelVersion);
  expect(analysis.datasetVersion).toBe(request.datasetVersion);

  const factIds = new Set(buildAnalysisFacts(simulation, data).map(fact => fact.id));
  const points = [analysis.summary, ...analysis.strengths, ...analysis.risks,
    ...analysis.tradeoffs, ...analysis.recommendations];
  for (const point of points) {
    expect(point.text.trim().length).toBeGreaterThan(0);
    expect(point.factIds.length).toBeGreaterThan(0);
    expect(point.factIds.every(id => factIds.has(id))).toBe(true);
  }
});
