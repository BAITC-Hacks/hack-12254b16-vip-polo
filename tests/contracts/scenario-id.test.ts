import { describe, expect, it } from "vitest";
import { makeScenarioId } from "@/shared/scenario-id";
import { scenarios } from "../fixtures";

describe("canonical scenario identity", () => {
  it("matches the independent golden ID and does not mutate input", () => {
    const input = structuredClone(scenarios.A.request);
    const original = structuredClone(input);
    if (!scenarios.A.expected.ok) throw new Error("Fixture A must be successful");
    expect(makeScenarioId(input)).toBe(scenarios.A.expected.data.scenarioId);
    expect(input).toEqual(original);
  });
  it("ignores ordering and distinguishes choices, districts and versions", () => {
    const a = scenarios.A.request;
    expect(makeScenarioId({ ...a, decisions: [...a.decisions].reverse() })).toBe(makeScenarioId(a));
    expect(makeScenarioId(scenarios.B.request)).not.toBe(makeScenarioId(a));
    expect(makeScenarioId({ ...a, modelVersion: "model-v2" })).not.toBe(makeScenarioId(a));
    expect(makeScenarioId({ ...a, datasetVersion: "synthetic-v2" })).not.toBe(makeScenarioId(a));
    expect(makeScenarioId({ ...a, decisions: a.decisions.map(d => ({ ...d, districtId: "south" })) })).not.toBe(makeScenarioId(a));
  });
  it("supports empty and partial drafts and stable duplicate tie-breaks", () => {
    expect(makeScenarioId({ ...scenarios.A.request, decisions: [] })).toBe('["model-v1","synthetic-v1",[]]');
    expect(makeScenarioId(scenarios.E.request)).not.toBe(makeScenarioId(scenarios.A.request));
    const decisions = [scenarios.A.request.decisions[0], scenarios.B.request.decisions[0]];
    expect(makeScenarioId({ ...scenarios.A.request, decisions })).toBe(makeScenarioId({ ...scenarios.A.request, decisions: [...decisions].reverse() }));
  });
});
