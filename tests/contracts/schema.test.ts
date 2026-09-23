import { describe, expect, it } from "vitest";
import { aiAnalysisSchema, scenarioRequestSchema } from "@/shared/schema";
import { scenarios } from "../fixtures";

describe("API shape boundary", () => {
  it("rejects supplied costs, scores and malformed fields", () => {
    const input = scenarios.A.request;
    expect(scenarioRequestSchema.safeParse({ ...input, score: 100 }).success).toBe(false);
    expect(scenarioRequestSchema.safeParse({ ...input, decisions: [{ ...input.decisions[0], cost: 0 }] }).success).toBe(false);
    expect(scenarioRequestSchema.safeParse({ ...input, decisions: [{ direction: "unknown", districtId: "north", initiativeId: "x" }] }).success).toBe(false);
    expect(scenarioRequestSchema.safeParse({ ...input, decisions: "bad" }).success).toBe(false);
  });
  it("allows a draft shape without claiming that business rules were checked", () => {
    expect(scenarioRequestSchema.safeParse({ ...scenarios.A.request, decisions: [] }).success).toBe(true);
    expect(scenarioRequestSchema.safeParse(scenarios.D.request).success).toBe(true);
  });
  it("distinguishes real AI from fallback and rejects invented response fields", () => {
    const point = { text: "Тестовое объяснение", factIds: ["score:after"] };
    const analysis = { scenarioId: "test", modelVersion: "model-v1", datasetVersion: "synthetic-v1", source: "ai", status: "ready", summary: point, strengths: [], risks: [], tradeoffs: [], recommendations: [] };
    expect(aiAnalysisSchema.safeParse(analysis).success).toBe(true);
    expect(aiAnalysisSchema.safeParse({ ...analysis, source: "fallback" }).success).toBe(false);
    expect(aiAnalysisSchema.safeParse({ ...analysis, source: "fallback", status: "unavailable" }).success).toBe(true);
    expect(aiAnalysisSchema.safeParse({ ...analysis, score: 100 }).success).toBe(false);
  });
});
