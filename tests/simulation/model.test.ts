import { describe, expect, it } from "vitest";
import { getGameData, simulateScenario, validateScenario } from "@/lib/simulation";
import { gameDataSchema, simulationOutcomeSchema } from "@/shared/schema";
import { scenarios } from "../fixtures";
import type { GameData, Outcome, ScenarioRequest, SimulationResult, ValidationMode } from "@/shared/types";

function result(request = scenarios.A.request, data = getGameData(), mode: ValidationMode = "final"): SimulationResult {
  const outcome = simulateScenario(request, data, mode);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
  return outcome.data;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}
const expectError = (outcome: Outcome<unknown>, code: string) => expect(outcome).toMatchObject({ ok: false, error: { code } });

describe("independent fixtures, determinism and isolation", () => {
  for (const [name, fixture] of Object.entries(scenarios)) {
    it(`matches the entire immutable fixture ${name}, including trace and facts`, () => {
      const actual = simulateScenario(fixture.request, getGameData(), fixture.mode);
      expect(actual).toEqual(fixture.expected);
      expect(simulationOutcomeSchema.safeParse(actual).success).toBe(true);
      if (fixture.finalExpected) expect(simulateScenario(fixture.request, getGameData(), "final")).toEqual(fixture.finalExpected);
    });
  }
  it("restores A after B, removal, restoration, and complete cancellation", () => {
    const data = freeze(getGameData());
    const initial = result(scenarios.A.request, data);
    const b = structuredClone(scenarios.A.request);
    b.decisions[0].initiativeId = "transport-premium";
    expect(result(b, data)).toEqual(result(scenarios.B.request, data));
    b.decisions[0].initiativeId = "transport-basic";
    expect(result(b, data)).toEqual(initial);
    const last = b.decisions.pop()!;
    expect(result(b, data, "draft")).toEqual(result(scenarios.E.request, data, "draft"));
    expectError(simulateScenario(b, data, "final"), "INCOMPLETE_SCENARIO");
    b.decisions.push(last);
    expect(result(b, data)).toEqual(initial);
    b.decisions = [];
    const empty = result(b, data, "draft");
    expect(empty.budget).toEqual({ initial: 100, spent: 0, remaining: 100 });
    expect(empty.score).toEqual({ before: 50, after: 50, delta: 0 });
    expect(empty.complete).toBe(false);
    expect(empty.trace.every(t => t.contributions.length === 0 && t.after === t.baseline)).toBe(true);
    expectError(simulateScenario(b, data, "final"), "INCOMPLETE_SCENARIO");
  });
  it("does not mutate frozen input, data, previous results or imported JSON", () => {
    const data = freeze(getGameData());
    const request = freeze(structuredClone(scenarios.A.request));
    const saved = JSON.stringify({ data, request });
    const initial = freeze(result(request, data));
    expect(result(request, data)).toEqual(initial);
    expect(JSON.stringify({ data, request })).toBe(saved);
    const copy = getGameData();
    copy.districts[0].baseline.transport = 0;
    copy.config.budget = 0;
    copy.initiatives[0].effects[0].delta = 0;
    copy.initiatives[0].eligibleDistrictIds.length = 0;
    expect(getGameData()).toEqual(data);
    const mutable = result(request, data);
    mutable.districts[0].before.transport = 0;
    mutable.districts[0].after.transport = 0;
    mutable.decisions.length = 0;
    mutable.trace[0].contributions.length = 0;
    expect(result(request, data)).toEqual(initial);
  });
  it("returns identical serialized results for all 120 decision permutations", () => {
    function permutations<T>(items: T[]): T[][] {
      return items.length === 0 ? [[]] : items.flatMap((item, i) =>
        permutations(items.filter((_, index) => index !== i)).map(tail => [item, ...tail]));
    }
    const data = getGameData();
    const expected = JSON.stringify(result(scenarios.A.request, data));
    for (const decisions of permutations(scenarios.A.request.decisions)) {
      expect(JSON.stringify(result({ ...scenarios.A.request, decisions }, data))).toBe(expected);
    }
  });
  it("permits every direction in every district and mixed-district plans", () => {
    const data = getGameData();
    for (const district of data.districts) {
      const request = { ...scenarios.A.request, decisions: scenarios.A.request.decisions.map(d => ({ ...d, districtId: district.id })) };
      expect(result(request, data).score.after).toBe(51.67);
    }
    const request = { ...scenarios.A.request, decisions: scenarios.A.request.decisions.map((d, i) => ({ ...d, districtId: data.districts[i % data.districts.length].id })) };
    expect(result(request, data).score.after).toBe(51.67);
  });
});

describe("strict request validation", () => {
  const invalidCases: [string, unknown, string][] = [
    ["null", null, "INVALID_REQUEST"],
    ["array", [], "INVALID_REQUEST"],
    ["missing keys", {}, "INVALID_REQUEST"],
    ["non-array decisions", { ...scenarios.A.request, decisions: {} }, "INVALID_REQUEST"],
    ["too many decisions", { ...scenarios.A.request, decisions: [...scenarios.A.request.decisions, scenarios.A.request.decisions[0]] }, "INVALID_REQUEST"],
    ["model version", { ...scenarios.A.request, modelVersion: "old" }, "VERSION_MISMATCH"],
    ["dataset version", { ...scenarios.A.request, datasetVersion: "old" }, "VERSION_MISMATCH"],
    ["non-string version", { ...scenarios.A.request, modelVersion: 1 }, "INVALID_REQUEST"],
    ["empty version", { ...scenarios.A.request, datasetVersion: "" }, "INVALID_REQUEST"],
    ["unknown district", { ...scenarios.A.request, decisions: [{ ...scenarios.A.request.decisions[0], districtId: "__proto__" }] }, "UNKNOWN_DISTRICT"],
    ["unknown initiative", { ...scenarios.A.request, decisions: [{ ...scenarios.A.request.decisions[0], initiativeId: "constructor" }] }, "UNKNOWN_INITIATIVE"],
    ["wrong direction", { ...scenarios.A.request, decisions: [{ ...scenarios.A.request.decisions[0], direction: "safety" }] }, "DIRECTION_MISMATCH"],
    ["unknown direction", { ...scenarios.A.request, decisions: [{ ...scenarios.A.request.decisions[0], direction: "other" }] }, "INVALID_REQUEST"],
    ["duplicate initiative", { ...scenarios.A.request, decisions: [scenarios.A.request.decisions[0], scenarios.A.request.decisions[0]] }, "DUPLICATE_INITIATIVE"],
    ["duplicate direction", { ...scenarios.A.request, decisions: [scenarios.A.request.decisions[0], { ...scenarios.A.request.decisions[0], initiativeId: "transport-standard" }] }, "DUPLICATE_DIRECTION"],
    ...["cost", "budget", "score", "Score", "facts", "effects", "mode"].map(key =>
      [`extra root ${key}`, { ...scenarios.A.request, [key]: 0 }, "INVALID_REQUEST"] as [string, unknown, string]),
    ...["cost", "budget", "score", "effects"].map(key =>
      [`extra decision ${key}`, { ...scenarios.A.request, decisions: [{ ...scenarios.A.request.decisions[0], [key]: 0 }] }, "INVALID_REQUEST"] as [string, unknown, string]),
  ];
  for (const [name, input, code] of invalidCases) {
    it(`rejects ${name} in both public functions`, () => {
      const data = getGameData();
      expectError(validateScenario(input, data, "draft"), code);
      // Exercise the runtime boundary even when a caller bypasses TypeScript.
      expectError(simulateScenario(input as ScenarioRequest, data, "draft"), code);
    });
  }
  it("rejects an ineligible district using an explicitly restricted test catalogue", () => {
    const data = getGameData();
    data.initiatives[0].eligibleDistrictIds = ["center"];
    expectError(simulateScenario(scenarios.A.request, data, "final"), "INCOMPATIBLE_DECISION");
  });
  it("rejects overspending in draft as well as final", () => {
    expectError(simulateScenario(scenarios.D.request, getGameData(), "draft"), "BUDGET_EXCEEDED");
    expectError(simulateScenario(scenarios.D.request, getGameData(), "final"), "BUDGET_EXCEEDED");
  });
  it("rejects an unknown validation mode", () => {
    expectError(validateScenario(scenarios.A.request, getGameData(), "invalid" as ValidationMode), "INVALID_REQUEST");
  });
});

describe("JSON data and calculations", () => {
  it("loads 3 districts and 15 fully described initiatives with valid runtime shape", () => {
    const data = getGameData();
    expect(gameDataSchema.safeParse(data).success).toBe(true);
    expect(data.districts).toHaveLength(3);
    expect(data.initiatives).toHaveLength(15);
    expect(new Set(data.initiatives.flatMap(i => i.effects.map(e => e.ruleId))).size).toBe(30);
    for (const initiative of data.initiatives) {
      expect(initiative.description).not.toMatch(/уточняет участник|Стартовое мероприятие/);
      expect(initiative.eligibleDistrictIds).toEqual(data.districts.map(d => d.id));
    }
  });
  it("reads costs, effects, budget and baseline from supplied data, not hardcoded rules", () => {
    const data = getGameData();
    data.config.budget = 101;
    data.initiatives[0].cost = 11;
    data.initiatives[0].effects[0].delta = 7;
    data.districts[0].baseline.transport = 41;
    const actual = result(scenarios.A.request, data);
    expect(actual.budget).toEqual({ initial: 101, spent: 51, remaining: 50 });
    expect(actual.districts[0].after.transport).toBe(47);
    expect(actual.trace[0]).toMatchObject({ baseline: 41, rawAfter: 47 });
    expect(actual.city.after.transport).toBe(157 / 3);
  });
  it("keeps intermediate city averages unrounded and rounds only published scores", () => {
    const actual = result();
    expect(actual.city.after.transport).toBe(155 / 3);
    expect(actual.city.after.transport).not.toBe(actual.score.after);
    expect(actual.score.after).toBe(51.67);
  });
  const brokenData: [string, (data: GameData) => void][] = [
    ["duplicate district", d => { d.districts[1].id = d.districts[0].id; }],
    ["duplicate initiative", d => { d.initiatives[1].id = d.initiatives[0].id; }],
    ["duplicate rule", d => { d.initiatives[1].effects[0].ruleId = d.initiatives[0].effects[0].ruleId; }],
    ["unknown eligible district", d => { d.initiatives[0].eligibleDistrictIds = ["missing"]; }],
    ["duplicate direction config", d => { d.config.directions[1] = "transport"; }],
    ["bad bounds", d => { d.config.bounds.min = 100; }],
    ["unequal weights", d => { d.config.metricWeights.transport = 0.5; }],
    ["missing district weight", d => { delete d.config.districtWeights.north; }],
    ["negative cost", d => { d.initiatives[0].cost = -1; }],
    ["nonfinite effect", d => { d.initiatives[0].effects[0].delta = Infinity; }],
  ];
  for (const [name, corrupt] of brokenData) it(`rejects corrupt data: ${name}`, () => {
    const data = getGameData();
    corrupt(data);
    expectError(simulateScenario(scenarios.A.request, data, "final"), "INTERNAL_ERROR");
  });
});

describe("clamp after summation and explainability", () => {
  it("records upper and lower clamps on explicit test baselines", () => {
    const data = getGameData();
    data.districts[0].baseline.transport = 99;
    data.districts[0].baseline.greenery = 1;
    const request = { ...scenarios.B.request, decisions: [scenarios.B.request.decisions[0]] };
    const actual = result(request, data, "draft");
    expect(actual.trace[0]).toMatchObject({ baseline: 99, rawAfter: 120, after: 100, clampAdjustment: -20 });
    expect(actual.trace[1]).toMatchObject({ baseline: 1, rawAfter: -2, after: 0, clampAdjustment: 2 });
  });
  it("sums positive then negative effects before the upper clamp", () => {
    const data = getGameData();
    data.districts[0].baseline.transport = 99;
    const request = { ...scenarios.A.request, decisions: [scenarios.A.request.decisions[0], scenarios.A.request.decisions[4]] };
    const entry = result(request, data, "draft").trace[0];
    expect(entry).toMatchObject({ rawAfter: 104, after: 100, clampAdjustment: -4 });
    expect(entry.contributions.map(c => c.delta)).toEqual([6, -1]);
    expect(entry.after).not.toBe(99); // clamping after the first contribution would lose 5.
  });
  it("sums negative then positive effects before the lower clamp", () => {
    const data = getGameData();
    data.districts[0].baseline.greenery = 1;
    const request = { ...scenarios.B.request, decisions: scenarios.B.request.decisions.slice(0, 2) };
    const entry = result(request, data, "draft").trace[1];
    expect(entry).toMatchObject({ rawAfter: 4, after: 4, clampAdjustment: 0 });
    expect(entry.contributions.map(c => c.delta)).toEqual([-3, 6]);
    expect(entry.after).not.toBe(6);
  });
  it("reconstructs every final metric and matches each effect fact to its rule", () => {
    const data = getGameData();
    const actual = result(scenarios.B.request, data);
    expect(new Set(actual.facts.map(f => f.id)).size).toBe(actual.facts.length);
    for (const entry of actual.trace) {
      expect(entry.baseline + entry.contributions.reduce((sum, c) => sum + c.delta, 0)).toBe(entry.rawAfter);
      expect(entry.rawAfter + entry.clampAdjustment).toBe(entry.after);
      expect(actual.districts.find(d => d.districtId === entry.districtId)!.after[entry.metric]).toBe(entry.after);
      for (const contribution of entry.contributions) {
        const rule = data.initiatives.find(i => i.id === contribution.initiativeId)!.effects.find(e => e.ruleId === contribution.ruleId)!;
        expect(rule.metric).toBe(entry.metric);
        expect(rule.delta).toBe(contribution.delta);
        expect(actual.facts.find(f => f.ruleId === rule.ruleId && f.districtId === entry.districtId)).toMatchObject({ value: rule.delta, kind: "effect" });
      }
    }
  });
});
