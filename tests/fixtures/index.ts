import a from "./scenario-A.json";
import b from "./scenario-B.json";
import c from "./scenario-C.json";
import d from "./scenario-D.json";
import e from "./scenario-E.json";
import { scenarioRequestSchema, simulationOutcomeSchema } from "@/shared/schema";
import type { Outcome, ScenarioRequest, SimulationResult, ValidationMode } from "@/shared/types";

interface ScenarioFixture {
  request: ScenarioRequest;
  mode: ValidationMode;
  expected: Outcome<SimulationResult>;
  finalExpected?: Outcome<SimulationResult>;
}
function fixture(raw: { request: unknown; mode: string; expected: unknown; finalExpected?: unknown }): ScenarioFixture {
  if (raw.mode !== "draft" && raw.mode !== "final") throw new Error("Invalid fixture mode");
  return { request: scenarioRequestSchema.parse(raw.request), mode: raw.mode, expected: simulationOutcomeSchema.parse(raw.expected),
    ...(raw.finalExpected ? { finalExpected: simulationOutcomeSchema.parse(raw.finalExpected) } : {}) };
}
export const scenarios = { A: fixture(a), B: fixture(b), C: fixture(c), D: fixture(d), E: fixture(e) };
