import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getGameData, simulateScenario, validateScenario } from "@/lib/simulation";
import { analyzeScenario, buildAnalysisFacts, buildFallbackAnalysis } from "@/lib/ai";
import { analysisOutcomeSchema } from "@/shared/schema";
import { POST as simulatePost } from "@/app/api/simulate/route";
import { POST as analysisPost } from "@/app/api/analysis/route";
import { scenarios } from "../fixtures";

beforeEach(() => { vi.stubEnv("AI_API_KEY", ""); vi.stubEnv("AI_PROVIDER", ""); vi.stubEnv("AI_MODEL", ""); });
afterEach(() => vi.unstubAllEnvs());
const request = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });

it("connects the shared ports to real calculation and explicit no-key fallback", async () => {
  const data = getGameData();
  expect(validateScenario(scenarios.A.request,data,"final")).toEqual({ ok: true, data: scenarios.A.request });
  expect(simulateScenario(scenarios.A.request,data,"final")).toEqual(scenarios.A.expected);
  if (!scenarios.A.expected.ok) throw new Error("Expected fixture result");
  const result = scenarios.A.expected.data;
  expect(buildAnalysisFacts(result,data)).toEqual(result.facts);
  expect(buildFallbackAnalysis(result)).toMatchObject({ source: "fallback", status: "unavailable", scenarioId: result.scenarioId });
  const outcome = await analyzeScenario(scenarios.A.request);
  expect(analysisOutcomeSchema.safeParse(outcome).success).toBe(true);
  expect(outcome).toMatchObject({ ok: true, data: { simulation: result, analysis: { source: "fallback", status: "unavailable" } } });
});

it.each([simulatePost, analysisPost])("enforces real route outcomes instead of placeholder status", async post => {
  const valid = await post(request(scenarios.A.request));
  expect(valid.status).toBe(200);
  const payload = await valid.json();
  if (post === simulatePost) expect(payload).toEqual(scenarios.A.expected);
  else expect(payload).toMatchObject({ ok: true, data: { simulation: scenarios.A.expected.ok ? scenarios.A.expected.data : null, analysis: { source: "fallback" } } });
  for (const [body, status, code] of [[{}, 400, "INVALID_REQUEST"], [scenarios.D.request, 422, "BUDGET_EXCEEDED"], [scenarios.E.request, 422, "INCOMPLETE_SCENARIO"]] as const) {
    const response = await post(request(body));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ ok: false, error: { code } });
  }
});
