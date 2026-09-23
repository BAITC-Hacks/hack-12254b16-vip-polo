import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scenarios } from "../fixtures";
import { getGameData, simulateScenario } from "@/lib/simulation";
import { analyzeScenario, buildAnalysisFacts, buildFallbackAnalysis } from "@/lib/ai";
import { parseExplanation } from "@/lib/ai/explanation";
import { analysisOutcomeSchema, aiAnalysisSchema } from "@/shared/schema";
import type { SimulationResult } from "@/shared/types";

vi.mock("@/lib/simulation", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/simulation")>();
  return { ...original, simulateScenario: vi.fn() };
});
function fixture(name: "A" | "B" | "C" = "A") {
  const outcome = scenarios[name].expected;
  if (!outcome.ok) throw new Error("Fixture must succeed");
  return structuredClone(outcome.data);
}
const point = (id: string) => ({ text: "Объяснение проверенного модельного факта без новых оценок.", factIds: [id] });
const valid = () => ({ summary: point("score:after"), strengths: [point("effect:transport-basic:north:transport")],
  risks: [point("score:after")], tradeoffs: [point("effect:service-basic:north:transport")], recommendations: [] });
const envelope = (value: unknown) => ({ status: "completed", output: [{ type: "message", role: "assistant", status: "completed",
  content: [{ type: "output_text", text: typeof value === "string" ? value : JSON.stringify(value) }] }] });
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "openai"); vi.stubEnv("AI_MODEL", "gpt-4.1-mini-2025-04-14");
  vi.stubEnv("AI_API_KEY", "unit-test-key-not-live"); vi.stubEnv("AI_TIMEOUT_MS", "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(Response.json(envelope(valid())));
  vi.mocked(simulateScenario).mockReset().mockReturnValue({ ok: true, data: fixture() });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("server analysis boundary", () => {
  it("recomputes final on server and returns only schema-checked explanations (mock provider, not live)", async () => {
    const response = await analyzeScenario(scenarios.A.request);
    expect(simulateScenario).toHaveBeenCalledWith(scenarios.A.request, getGameData(), "final");
    expect(analysisOutcomeSchema.safeParse(response).success).toBe(true);
    expect(response).toMatchObject({ ok: true, data: { simulation: fixture(), analysis: { source: "ai", status: "ready", providerModel: "openai/gpt-4.1-mini-2025-04-14" } } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(String(options?.body));
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(JSON.parse(body.input).facts).toEqual(fixture().facts);
    expect(JSON.stringify(response)).not.toContain("unit-test-key");
  });
  it.each(["score", "budget", "facts", "cost"])("rejects browser %s without provider or simulation", async field => {
    expect(await analyzeScenario({ ...scenarios.A.request, [field]: 999 })).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
    expect(simulateScenario).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["BUDGET_EXCEEDED", "INCOMPLETE_SCENARIO", "UNKNOWN_DISTRICT", "VERSION_MISMATCH", "NOT_IMPLEMENTED"] as const)("never calls provider for %s", async code => {
    vi.mocked(simulateScenario).mockReturnValue({ ok: false, error: { code, message: "Сценарий отклонён" } });
    expect(await analyzeScenario(scenarios.D.request)).toMatchObject({ ok: false, error: { code } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("masks simulation exceptions", async () => {
    vi.mocked(simulateScenario).mockImplementation(() => { throw new Error("SECRET stack private"); });
    const response = await analyzeScenario(scenarios.A.request);
    expect(response).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(response)).not.toMatch(/SECRET|stack|private/); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects mismatched server scenario and tampered facts before provider", async () => {
    vi.mocked(simulateScenario).mockReturnValue({ ok: true, data: fixture("B") });
    expect(await analyzeScenario(scenarios.A.request)).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    const bad = fixture(); bad.facts[1].value = 99;
    vi.mocked(simulateScenario).mockReturnValue({ ok: true, data: bad });
    expect(await analyzeScenario(scenarios.A.request)).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fallback and deadline", () => {
  it.each([
    ["AI_API_KEY", ""], ["AI_PROVIDER", ""], ["AI_PROVIDER", "unsupported"], ["AI_MODEL", ""],
    ["AI_TIMEOUT_MS", "0"], ["AI_TIMEOUT_MS", "NaN"], ["AI_TIMEOUT_MS", "60001"], ["AI_TIMEOUT_MS", "1.5"],
  ])("unavailable without supported configuration %s=%s", async (key, value) => {
    vi.stubEnv(key, value);
    const response = await analyzeScenario(scenarios.A.request);
    expect(response).toMatchObject({ ok: true, data: { simulation: fixture(), analysis: { source: "fallback", status: "unavailable" } } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 500, 503])("HTTP %i falls back without retries or leaking provider body", async status => {
    fetchMock.mockResolvedValue(new Response("private error SECRET", { status }));
    const response = await analyzeScenario(scenarios.A.request);
    expect(response).toMatchObject({ ok: true, data: { analysis: { source: "fallback", status: "unavailable" } } });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(JSON.stringify(response)).not.toContain("SECRET");
  });
  it("network failure returns unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("unit-test-key-not-live"));
    expect(await analyzeScenario(scenarios.A.request)).toMatchObject({ ok: true, data: { analysis: { source: "fallback", status: "unavailable" } } });
  });
  it.each([undefined, "25"])("deadline includes non-cooperative fetch, timeout=%s", async timeout => {
    vi.useFakeTimers(); if (timeout) vi.stubEnv("AI_TIMEOUT_MS", timeout);
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const response = analyzeScenario(scenarios.A.request);
    await vi.advanceTimersByTimeAsync(timeout ? 24 : 14999);
    let settled = false; void response.then(() => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await response).toMatchObject({ ok: true, data: { analysis: { source: "fallback", status: "timeout" } } });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("deadline includes a stalled response body", async () => {
    vi.useFakeTimers(); vi.stubEnv("AI_TIMEOUT_MS", "20");
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode("{")); }, cancel });
    fetchMock.mockResolvedValue(new Response(stream));
    const response = analyzeScenario(scenarios.A.request);
    await vi.advanceTimersByTimeAsync(20);
    expect(await response).toMatchObject({ ok: true, data: { analysis: { status: "timeout" } } });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe("provider runtime validation", () => {
  const invalid: [string, () => unknown][] = [
    ["bad JSON", () => "{"], ["unknown fact", () => ({ ...valid(), summary: point("unknown") })],
    ["new Score field", () => ({ ...valid(), score: 99 })],
    ["numeric Score in prose", () => ({ ...valid(), summary: { ...point("score:after"), text: "Я утверждаю, что итоговый Score равен 99 баллам." } })],
    ["nested score", () => ({ ...valid(), summary: { ...point("score:after"), score: 99 } })],
    ["empty text", () => ({ ...valid(), summary: { ...point("score:after"), text: " " } })],
    ["long text", () => ({ ...valid(), summary: { ...point("score:after"), text: "я".repeat(601) } })],
    ["missing field", () => ({ summary: point("score:after") })],
    ["too many points", () => ({ ...valid(), strengths: Array.from({ length: 5 }, () => point("score:after")) })],
    ["empty refs", () => ({ ...valid(), summary: { ...point("score:after"), factIds: [] } })],
    ["duplicate refs", () => ({ ...valid(), summary: { ...point("score:after"), factIds: ["score:after", "score:after"] } })],
    ["source spoofing", () => ({ ...valid(), source: "ai", status: "ready" })],
  ];
  it.each(invalid)("%s becomes invalid_response", async (_name, value) => {
    fetchMock.mockResolvedValue(Response.json(envelope(value())));
    const response = await analyzeScenario(scenarios.A.request);
    expect(response).toMatchObject({ ok: true, data: { simulation: fixture(), analysis: { source: "fallback", status: "invalid_response" } } });
    expect(analysisOutcomeSchema.safeParse(response).success).toBe(true);
  });
  it.each([
    { status: "incomplete", output: [] }, { status: "completed", output: [] },
    { status: "completed", output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "No" }] }] },
    { status: "completed", output: [...envelope(valid()).output, ...envelope(valid()).output] },
    { status: "completed", output: [{ ...envelope(valid()).output[0], content: [...envelope(valid()).output[0].content, ...envelope(valid()).output[0].content] }] },
  ])("refusal/incomplete/empty output is invalid", async body => {
    fetchMock.mockResolvedValue(Response.json(body));
    expect(await analyzeScenario(scenarios.A.request)).toMatchObject({ ok: true, data: { analysis: { status: "invalid_response" } } });
  });
  it.each(["not json", " ".repeat(65537)])("rejects malformed or oversized transport response", async body => {
    fetchMock.mockResolvedValue(new Response(body));
    expect(await analyzeScenario(scenarios.A.request)).toMatchObject({ ok: true, data: { analysis: { status: "invalid_response" } } });
  });
});

describe("facts provenance", () => {
  it.each(["A", "B", "C"] as const)("accepts independent fixture %s without mutation", name => {
    const result = fixture(name); const data = getGameData();
    const snapshot = structuredClone({ result, data });
    const facts = buildAnalysisFacts(result, data);
    expect(facts).toEqual(result.facts); expect({ result, data }).toEqual(snapshot);
    facts[0].value = -1; expect(result.facts[0].value).toBe(snapshot.result.facts[0].value);
    const fallback = buildFallbackAnalysis(result);
    expect(aiAnalysisSchema.safeParse(fallback).success).toBe(true);
    expect(parseExplanation({ summary: fallback.summary, strengths: fallback.strengths, risks: fallback.risks,
      tradeoffs: fallback.tradeoffs, recommendations: fallback.recommendations }, result.facts)).not.toBeNull();
  });
  const tamper: [string, (r: SimulationResult) => void][] = [
    ["score fact", r => { r.facts[1].value = 99; }], ["budget", r => { r.budget.spent = 1; }],
    ["unknown fact", r => { r.facts[0].id = "unknown"; }], ["missing fact", r => { r.facts.pop(); }],
    ["duplicate fact", r => { r.facts[1] = r.facts[0]; }], ["unit", r => { r.facts[0].unit = "secret"; }],
    ["trace baseline", r => { r.trace[0].baseline = 0; }], ["trace after", r => { r.trace[0].after = 99; }],
    ["raw sum", r => { r.trace[0].rawAfter = 99; }], ["clamp", r => { r.trace[0].clampAdjustment = 1; }],
    ["contribution", r => { r.trace[0].contributions[0].delta = 999; }],
    ["unknown rule", r => { r.trace[0].contributions[0].ruleId = "unknown"; }],
    ["missing contribution", r => { r.trace[0].contributions.pop(); }],
    ["missing trace", r => { r.trace.pop(); }], ["duplicate trace", r => { r.trace[1] = r.trace[0]; }],
    ["missing district", r => { r.districts.pop(); }], ["district before", r => { r.districts[0].before.transport = 0; }],
    ["version", r => { r.modelVersion = "other"; }], ["incomplete", r => { r.complete = false; }],
  ];
  it.each(tamper)("rejects %s", (_name, mutate) => {
    const result = fixture(); mutate(result);
    expect(() => buildAnalysisFacts(result, getGameData())).toThrow();
  });
});
