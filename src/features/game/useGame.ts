"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { simulateScenario } from "@/lib/simulation";
import { analysisOutcomeSchema, simulationOutcomeSchema } from "@/shared/schema";
import { makeScenarioId } from "@/shared/scenario-id";
import type { AnalysisUiState, Decision, GameData, Outcome, ScenarioRequest, SimulationResult } from "@/shared/types";
import type { z } from "zod";

async function post<T>(url: string, request: ScenarioRequest, signal: AbortSignal, schema: z.ZodType<Outcome<T>>): Promise<Outcome<T>> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal });
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Сервер вернул некорректный ответ. Попробуйте ещё раз.");
  if (!response.ok && parsed.data.ok) throw new Error("Не удалось получить результат. Попробуйте ещё раз.");
  return parsed.data;
}
function matches(result: SimulationResult, request: ScenarioRequest) {
  return result.complete && result.scenarioId === makeScenarioId(request)
    && result.modelVersion === request.modelVersion && result.datasetVersion === request.datasetVersion
    && makeScenarioId({ ...request, decisions: result.decisions }) === makeScenarioId(request);
}
const errorText = (error: unknown) => error instanceof Error ? error.message : "Не удалось связаться с сервером. Попробуйте ещё раз.";

export function useGame(data: GameData) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisUiState>({ status: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const active = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const request = useMemo<ScenarioRequest>(() => ({ modelVersion: data.config.modelVersion, datasetVersion: data.config.datasetVersion, decisions }), [data.config.modelVersion, data.config.datasetVersion, decisions]);
  const previewOutcome = useMemo(() => simulateScenario(request, data, "draft"), [request, data]);
  const preview = previewOutcome.ok ? previewOutcome.data : null;
  const unavailable = !previewOutcome.ok && previewOutcome.error.code === "NOT_IMPLEMENTED";
  useEffect(() => () => { revision.current++; active.current?.abort(); }, []);

  function invalidate() {
    revision.current++; active.current?.abort(); active.current = null; busy.current = false;
    setSubmitting(false); setResult(null); setAnalysisState({ status: "idle" }); setError(null);
  }
  function change(next: Decision[]) {
    const check = simulateScenario({ ...request, decisions: next }, data, "draft");
    if (!check.ok && check.error.code !== "NOT_IMPLEMENTED") { setError(check.error.message); return; }
    invalidate(); setDecisions(next);
  }
  function select(decision: Decision) { change([...decisions.filter(item => item.direction !== decision.direction), decision]); }
  function remove(direction: Decision["direction"]) { change(decisions.filter(item => item.direction !== direction)); }
  function replay() { invalidate(); setDecisions([]); }
  function edit() { invalidate(); }
  function begin() {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const token = ++revision.current;
    const current = () => revision.current === token && active.current === controller && !controller.signal.aborted;
    return { controller, current };
  }
  async function analyze(snapshot: ScenarioRequest, controller: AbortController, current: () => boolean) {
    setAnalysisState({ status: "loading" });
    try {
      const outcome = await post("/api/analysis", snapshot, controller.signal, analysisOutcomeSchema);
      if (!current()) return;
      if (!outcome.ok) throw new Error(outcome.error.message);
      const { simulation, analysis } = outcome.data;
      if (!matches(simulation, snapshot) || analysis.scenarioId !== makeScenarioId(snapshot)
        || analysis.modelVersion !== snapshot.modelVersion || analysis.datasetVersion !== snapshot.datasetVersion) {
        throw new Error("Ответ анализа относится к другому сценарию. Повторите анализ.");
      }
      setAnalysisState({ status: "ready", analysis });
    } catch (error) { if (current()) setAnalysisState({ status: "error", message: errorText(error) }); }
    finally { if (current()) busy.current = false; }
  }
  async function finish() {
    if (busy.current) return;
    const check = simulateScenario(request, data, "final");
    if (!check.ok) { setError(check.error.message); return; }
    const snapshot = request;
    const { controller, current } = begin();
    busy.current = true; setSubmitting(true); setResult(null); setAnalysisState({ status: "idle" }); setError(null);
    try {
      const outcome = await post("/api/simulate", snapshot, controller.signal, simulationOutcomeSchema);
      if (!current()) return;
      if (!outcome.ok) throw new Error(outcome.error.message);
      if (!matches(outcome.data, snapshot)) throw new Error("Ответ расчёта относится к другому сценарию. Повторите расчёт.");
      setResult(outcome.data); setSubmitting(false);
      await analyze(snapshot, controller, current);
    } catch (error) { if (current()) { setError(errorText(error)); setSubmitting(false); busy.current = false; } }
  }
  async function retryAnalysis() {
    if (!result || busy.current) return;
    busy.current = true;
    const { controller, current } = begin();
    await analyze(request, controller, current);
  }
  return { decisions, preview, previewOutcome, unavailable, result, analysisState, submitting, error, select, remove, replay, edit, finish, retryAnalysis };
}
