import { expect, it } from "vitest";
import { getGameData, simulateScenario, validateScenario } from "@/lib/simulation";
import { analyzeScenario, buildAnalysisFacts, buildFallbackAnalysis } from "@/lib/ai";
import { ScaffoldNotImplementedError } from "@/shared/not-implemented";
import { POST as simulatePost } from "@/app/api/simulate/route";
import { POST as analysisPost } from "@/app/api/analysis/route";
import { scenarios } from "../fixtures";

it("exposes honest replaceable placeholders without calculating or calling AI", async () => {
  const data = getGameData();
  const unavailable = { ok: false, error: { code: "NOT_IMPLEMENTED" } };
  expect(validateScenario(scenarios.A.request,data,"final")).toMatchObject(unavailable);
  expect(simulateScenario(scenarios.A.request,data,"final")).toMatchObject(unavailable);
  expect(await analyzeScenario(scenarios.A.request)).toMatchObject(unavailable);
  if (!scenarios.A.expected.ok) throw new Error("Expected fixture result");
  const result = scenarios.A.expected.data;
  expect(() => buildAnalysisFacts(result,data)).toThrow(ScaffoldNotImplementedError);
  expect(() => buildFallbackAnalysis(result)).toThrow(ScaffoldNotImplementedError);
  for (const response of [await simulatePost(), await analysisPost()]) {
    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject(unavailable);
  }
});
