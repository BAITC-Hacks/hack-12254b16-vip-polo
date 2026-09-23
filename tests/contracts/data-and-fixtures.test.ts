import { describe, expect, it } from "vitest";
import { getGameData } from "@/lib/simulation";
import { DIRECTIONS } from "@/shared/constants";
import { gameDataSchema, scenarioRequestSchema, simulationOutcomeSchema } from "@/shared/schema";
import { scenarios } from "../fixtures";

describe("shared data and golden fixtures (not a simulation implementation)", () => {
  it("has the agreed synthetic baseline and one affordable option per direction", () => {
    const data = getGameData();
    expect(gameDataSchema.safeParse(data).success).toBe(true);
    expect(data.config).toMatchObject({ budget: 100, modelVersion: "model-v1", datasetVersion: "synthetic-v1", synthetic: true });
    expect(data.districts.map(d => Object.values(d.baseline))).toEqual([[40,65,45,55,45],[65,35,60,40,50],[45,50,45,55,55]]);
    expect(Object.values(data.config.metricWeights).reduce((a,b) => a+b,0)).toBeCloseTo(1);
    expect(Object.values(data.config.districtWeights).reduce((a,b) => a+b,0)).toBeCloseTo(1);
    expect(data.initiatives).toHaveLength(15);
    expect(new Set(data.initiatives.map(i => i.id)).size).toBe(15);
    for (const direction of DIRECTIONS) {
      expect(data.initiatives.filter(i => i.direction === direction).map(i => [i.cost, ...i.effects.map(e => e.delta)])).toEqual([[10,6,-1],[20,12,-2],[30,21,-3]]);
    }
    expect(data.initiatives.filter(i => i.id.endsWith("-basic")).reduce((sum,i) => sum+i.cost,0)).toBe(50);
    for (const initiative of data.initiatives) expect(initiative.eligibleDistrictIds).toEqual(data.districts.map(d => d.id));
  });
  it("returns independent data so UI edits cannot mutate the common baseline", () => {
    const data = getGameData();
    data.districts[0].baseline.transport = 0;
    data.initiatives[0].cost = 999;
    expect(getGameData().districts[0].baseline.transport).toBe(40);
    expect(getGameData().initiatives[0].cost).toBe(10);
  });
  it("stores complete A–E request/response contracts with independent expected numbers", () => {
    for (const fixture of Object.values(scenarios)) {
      expect(scenarioRequestSchema.safeParse(fixture.request).success).toBe(true);
      expect(simulationOutcomeSchema.safeParse(fixture.expected).success).toBe(true);
    }
    for (const [name,spent,score,north] of [
      ["A",50,51.67,[45,70,50,60,50]],
      ["B",70,52.53,[60,68,50,60,50]],
      ["C",100,53.33,[50,75,55,65,55]],
      ["E",40,51.33,[46,70,50,60,44]]
    ] as const) {
      const result = scenarios[name].expected;
      if (!result.ok) throw new Error(`${name} must contain a result`);
      expect(result.data.budget.spent).toBe(spent);
      expect(result.data.score.after).toBe(score);
      expect(Object.values(result.data.districts[0].after)).toEqual(north);
      expect(result.data.trace).toHaveLength(15);
      expect(new Set(result.data.facts.map(f => f.id)).size).toBe(result.data.facts.length);
      // Internal arithmetic consistency of static expected answers, not runtime simulation.
      expect(Number((result.data.districts.flatMap(d => Object.values(d.after)).reduce((a,b) => a+b,0)/15).toFixed(2))).toBe(score);
      for (const t of result.data.trace) expect(t.baseline + t.contributions.reduce((sum,c) => sum+c.delta,0)).toBe(t.rawAfter);
    }
    expect(scenarios.D.expected).toMatchObject({ ok: false, error: { code: "BUDGET_EXCEEDED" } });
    expect(scenarios.E.finalExpected).toMatchObject({ ok: false, error: { code: "INCOMPLETE_SCENARIO" } });
  });
});
