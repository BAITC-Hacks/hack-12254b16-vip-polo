export type Direction = 'transport' | 'greenery' | 'social' | 'safety' | 'service';
export type Metrics = Record<Direction, number>;
export type ValidationMode = 'draft' | 'final';

export interface District {
  id: string;
  name: string;
  baseline: Metrics;
}
export interface Effect {
  ruleId: string;
  metric: Direction;
  delta: number;
  explanation: string;
}
export interface Initiative {
  id: string;
  direction: Direction;
  title: string;
  description: string;
  cost: number;
  eligibleDistrictIds: string[];
  effects: Effect[];
}
export interface Decision {
  direction: Direction;
  districtId: string;
  initiativeId: string;
}
export interface ScenarioConfig {
  modelVersion: string;
  datasetVersion: string;
  synthetic: true;
  budget: number;
  currencyLabel: string;
  directions: Direction[];
  metricWeights: Metrics;
  districtWeights: Record<string, number>;
  bounds: { min: number; max: number };
  horizonLabel: string;
}
export interface GameData {
  config: ScenarioConfig;
  districts: District[];
  initiatives: Initiative[];
}
export interface ScenarioRequest {
  modelVersion: string;
  datasetVersion: string;
  decisions: Decision[];
}
export interface MetricTrace {
  districtId: string;
  metric: Direction;
  baseline: number;
  contributions: {
    initiativeId: string;
    ruleId: string;
    delta: number;
  }[];
  rawAfter: number;
  after: number;
  clampAdjustment: number;
}
export interface Fact {
  id: string;
  kind: 'budget' | 'score' | 'metric' | 'effect';
  label: string;
  value: number;
  unit: string;
  districtId?: string;
  initiativeId?: string;
  ruleId?: string;
}
export interface SimulationResult {
  scenarioId: string;
  modelVersion: string;
  datasetVersion: string;
  complete: boolean;
  decisions: Decision[];
  budget: { initial: number; spent: number; remaining: number };
  districts: { districtId: string; before: Metrics; after: Metrics }[];
  city: { before: Metrics; after: Metrics };
  score: { before: number; after: number; delta: number };
  trace: MetricTrace[];
  facts: Fact[];
  warnings: string[];
}
export type ErrorCode =
  | 'INVALID_REQUEST' | 'UNKNOWN_DISTRICT' | 'UNKNOWN_INITIATIVE'
  | 'DUPLICATE_DIRECTION' | 'DUPLICATE_INITIATIVE' | 'DIRECTION_MISMATCH'
  | 'INCOMPATIBLE_DECISION' | 'INCOMPLETE_SCENARIO' | 'BUDGET_EXCEEDED'
  | 'VERSION_MISMATCH' | 'PAYLOAD_TOO_LARGE' | 'NOT_IMPLEMENTED'
  | 'INTERNAL_ERROR';
export interface AppError {
  code: ErrorCode;
  message: string;
  field?: string;
  details?: Record<string, string | number | boolean>;
}
export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
export interface AnalysisPoint {
  text: string;
  factIds: string[];
}
export interface AIAnalysis {
  scenarioId: string;
  modelVersion: string;
  datasetVersion: string;
  source: 'ai' | 'fallback';
  status: 'ready' | 'unavailable' | 'timeout' | 'invalid_response';
  summary: AnalysisPoint;
  strengths: AnalysisPoint[];
  risks: AnalysisPoint[];
  tradeoffs: AnalysisPoint[];
  recommendations: AnalysisPoint[];
  providerModel?: string;
}
export interface AnalysisResponse {
  simulation: SimulationResult;
  analysis: AIAnalysis;
}
export type AnalysisUiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; analysis: AIAnalysis }
  | { status: 'error'; message: string };
