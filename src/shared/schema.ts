import { z } from "zod";
import { DIRECTIONS } from "./constants";
import type { AIAnalysis, AnalysisResponse, AppError, Decision, District, Effect, Fact, GameData, Initiative, Metrics, MetricTrace, Outcome, ScenarioConfig, ScenarioRequest, SimulationResult } from "./types";

const id = z.string().min(1).max(200);
const text = z.string().min(1).max(4000);
const number = z.number().finite();
const index = number.min(0).max(100);
export const directionSchema = z.enum(DIRECTIONS);
export const metricsSchema = z.strictObject({ transport: index, greenery: index, social: index, safety: index, service: index }) satisfies z.ZodType<Metrics>;
export const districtSchema = z.strictObject({ id, name: text, baseline: metricsSchema }) satisfies z.ZodType<District>;
export const effectSchema = z.strictObject({ ruleId: id, metric: directionSchema, delta: number, explanation: text }) satisfies z.ZodType<Effect>;
export const initiativeSchema = z.strictObject({ id, direction: directionSchema, title: text, description: text, cost: number.int().nonnegative(), eligibleDistrictIds: z.array(id).min(1), effects: z.array(effectSchema).min(1) }) satisfies z.ZodType<Initiative>;
export const decisionSchema = z.strictObject({ direction: directionSchema, districtId: id, initiativeId: id }) satisfies z.ZodType<Decision>;
export const scenarioConfigSchema = z.strictObject({
  modelVersion: id, datasetVersion: id, synthetic: z.literal(true),
  budget: number.int().nonnegative(), currencyLabel: text, directions: z.array(directionSchema).length(5),
  metricWeights: metricsSchema, districtWeights: z.record(id, number.nonnegative()),
  bounds: z.strictObject({ min: number, max: number }), horizonLabel: text
}) satisfies z.ZodType<ScenarioConfig>;
export const gameDataSchema = z.strictObject({ config: scenarioConfigSchema, districts: z.array(districtSchema).min(1), initiatives: z.array(initiativeSchema).min(1) }) satisfies z.ZodType<GameData>;

// Shape validation only. Budget, IDs, duplicates and final completeness belong to participant 2.
export const scenarioRequestSchema = z.strictObject({ modelVersion: id, datasetVersion: id, decisions: z.array(decisionSchema).max(5) }) satisfies z.ZodType<ScenarioRequest>;
export const metricTraceSchema = z.strictObject({
  districtId: id, metric: directionSchema, baseline: index,
  contributions: z.array(z.strictObject({ initiativeId: id, ruleId: id, delta: number })),
  rawAfter: number, after: index, clampAdjustment: number
}) satisfies z.ZodType<MetricTrace>;
export const factSchema = z.strictObject({
  id, kind: z.enum(["budget", "score", "metric", "effect"]), label: text, value: number,
  unit: text, districtId: id.optional(), initiativeId: id.optional(), ruleId: id.optional()
}) satisfies z.ZodType<Fact>;
export const simulationResultSchema = z.strictObject({
  scenarioId: z.string().min(1).max(8192), modelVersion: id, datasetVersion: id, complete: z.boolean(),
  decisions: z.array(decisionSchema).max(5),
  budget: z.strictObject({ initial: number.nonnegative(), spent: number.nonnegative(), remaining: number.nonnegative() }),
  districts: z.array(z.strictObject({ districtId: id, before: metricsSchema, after: metricsSchema })),
  city: z.strictObject({ before: metricsSchema, after: metricsSchema }),
  score: z.strictObject({ before: index, after: index, delta: number }),
  trace: z.array(metricTraceSchema), facts: z.array(factSchema), warnings: z.array(text)
}) satisfies z.ZodType<SimulationResult>;
export const errorCodeSchema = z.enum([
  "INVALID_REQUEST", "UNKNOWN_DISTRICT", "UNKNOWN_INITIATIVE", "DUPLICATE_DIRECTION", "DUPLICATE_INITIATIVE",
  "DIRECTION_MISMATCH", "INCOMPATIBLE_DECISION", "INCOMPLETE_SCENARIO", "BUDGET_EXCEEDED", "VERSION_MISMATCH",
  "PAYLOAD_TOO_LARGE", "NOT_IMPLEMENTED", "INTERNAL_ERROR"
]);
export const appErrorSchema = z.strictObject({ code: errorCodeSchema, message: text, field: id.optional(), details: z.record(z.string(), z.union([z.string(), number, z.boolean()])).optional() }) satisfies z.ZodType<AppError>;
export function outcomeSchema<T>(schema: z.ZodType<T>): z.ZodType<Outcome<T>> {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), data: schema }),
    z.strictObject({ ok: z.literal(false), error: appErrorSchema })
  ]);
}
export const analysisPointSchema = z.strictObject({ text, factIds: z.array(id).min(1).max(30) });
export const aiAnalysisSchema = z.strictObject({
  scenarioId: z.string().min(1).max(8192), modelVersion: id, datasetVersion: id,
  source: z.enum(["ai", "fallback"]), status: z.enum(["ready", "unavailable", "timeout", "invalid_response"]),
  summary: analysisPointSchema, strengths: z.array(analysisPointSchema).max(10), risks: z.array(analysisPointSchema).max(10),
  tradeoffs: z.array(analysisPointSchema).max(10), recommendations: z.array(analysisPointSchema).max(10), providerModel: id.optional()
}).refine(a => (a.source === "ai") === (a.status === "ready"), { message: "Только настоящий AI может иметь status=ready." }) satisfies z.ZodType<AIAnalysis>;
export const analysisResponseSchema = z.strictObject({ simulation: simulationResultSchema, analysis: aiAnalysisSchema }) satisfies z.ZodType<AnalysisResponse>;
export const simulationOutcomeSchema = outcomeSchema(simulationResultSchema);
export const analysisOutcomeSchema = outcomeSchema(analysisResponseSchema);
