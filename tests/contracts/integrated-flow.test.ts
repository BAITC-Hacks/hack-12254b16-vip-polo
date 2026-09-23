import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeScenario } from "@/lib/ai";
import { getGameData, simulateScenario } from "@/lib/simulation";
import { analysisOutcomeSchema, simulationOutcomeSchema } from "@/shared/schema";
import { scenarios } from "../fixtures";

beforeEach(() => {
  // Exercise the real server fallback without inheriting a developer's live key.
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("AI_MODEL", "integration-test-model");
  vi.stubEnv("AI_API_KEY", undefined);
  vi.stubEnv("AI_TIMEOUT_MS", undefined);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request in offline integration test"));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("real simulation connected to server analysis without an AI key", () => {
  it.each(["A", "B", "C"] as const)("preserves the full independent fixture %s through fallback analysis", async name => {
    const fixture = scenarios[name];
    if (!fixture.expected.ok) throw new Error("Expected a successful reference fixture");
    const request = structuredClone(fixture.request);
    const savedRequest = structuredClone(request);

    const calculation = simulateScenario(request, getGameData(), "final");
    expect(calculation).toEqual(fixture.expected);
    expect(simulationOutcomeSchema.safeParse(calculation).success).toBe(true);

    // Neither module is mocked: analysis must independently recalculate and verify facts.
    const response = await analyzeScenario(request);
    expect(analysisOutcomeSchema.safeParse(response).success).toBe(true);
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error(response.error.code);
    expect(response.data.simulation).toEqual(fixture.expected.data);
    expect(response.data.analysis).toMatchObject({
      source: "fallback",
      status: "unavailable",
      scenarioId: fixture.expected.data.scenarioId,
      modelVersion: fixture.request.modelVersion,
      datasetVersion: fixture.request.datasetVersion,
    });
    const factIds = new Set(response.data.simulation.facts.map(fact => fact.id));
    const explanation = response.data.analysis;
    const points = [explanation.summary, ...explanation.strengths, ...explanation.risks,
      ...explanation.tradeoffs, ...explanation.recommendations];
    for (const point of points) {
      expect(point.factIds.length).toBeGreaterThan(0);
      expect(point.factIds.every(id => factIds.has(id))).toBe(true);
    }
    expect(request).toEqual(savedRequest);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["D", "BUDGET_EXCEEDED"],
    ["E", "INCOMPLETE_SCENARIO"],
  ] as const)("rejects real invalid final scenario %s before any provider request", async (name, code) => {
    const fixture = scenarios[name];
    const expected = fixture.finalExpected ?? fixture.expected;
    expect(simulateScenario(fixture.request, getGameData(), "final")).toEqual(expected);
    const response = await analyzeScenario(fixture.request);
    expect(response).toEqual(expected);
    expect(response).toMatchObject({ ok: false, error: { code } });
    expect(analysisOutcomeSchema.safeParse(response).success).toBe(true);
    expect(response).not.toHaveProperty("data");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("releases the old cost when replacing C and leaves the accepted scenario untouched after overspending", async () => {
    const data = getGameData();
    const savedData = structuredClone(data);
    const original = structuredClone(scenarios.C.request);
    const savedOriginal = structuredClone(original);
    const initial = simulateScenario(original, data, "draft");
    expect(initial).toEqual(scenarios.C.expected);

    const cheaper = structuredClone(original);
    cheaper.decisions.find(decision => decision.direction === "transport")!.initiativeId = "transport-basic";
    const replacement = simulateScenario(cheaper, data, "draft");
    expect(replacement).toMatchObject({ ok: true, data: {
      complete: true, budget: { initial: 100, spent: 90, remaining: 10 },
    } });
    if (!replacement.ok) throw new Error(replacement.error.code);
    const analysis = await analyzeScenario(cheaper);
    expect(analysis).toMatchObject({ ok: true, data: {
      simulation: replacement.data,
      analysis: { source: "fallback", status: "unavailable" },
    } });

    const expensive = structuredClone(original);
    expensive.decisions.find(decision => decision.direction === "transport")!.initiativeId = "transport-premium";
    const savedExpensive = structuredClone(expensive);
    expect(simulateScenario(expensive, data, "draft")).toMatchObject({
      ok: false, error: { code: "BUDGET_EXCEEDED", details: { budget: 100, spent: 110 } },
    });
    expect(expensive).toEqual(savedExpensive);
    expect(original).toEqual(savedOriginal);
    expect(data).toEqual(savedData);
    expect(initial).toEqual(scenarios.C.expected);
    expect(simulateScenario(original, data, "final")).toEqual(scenarios.C.expected);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
