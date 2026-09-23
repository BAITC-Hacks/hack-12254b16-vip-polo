// @vitest-environment jsdom
import { expect, it } from "vitest";
import { getGameData, simulateScenario, validateScenario } from "@/lib/simulation";
import { scenarios } from "../fixtures";

it("runs the public simulation exports in a browser-like environment", () => {
  expect(window.document).toBeDefined();
  const data = getGameData();
  expect(validateScenario(scenarios.A.request, data, "final").ok).toBe(true);
  expect(simulateScenario(scenarios.A.request, data, "final")).toEqual(scenarios.A.expected);
  expect(simulateScenario(scenarios.B.request, data, "final")).toEqual(scenarios.B.expected);
});
