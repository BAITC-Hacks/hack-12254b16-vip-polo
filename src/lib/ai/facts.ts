import "server-only";
import { gameDataSchema, simulationResultSchema } from "@/shared/schema";
import { makeScenarioId } from "@/shared/scenario-id";
import type { AnalysisPort } from "@/shared/ports";
import type { Fact } from "@/shared/types";

function verify(condition: boolean): asserts condition {
  if (!condition) throw new Error("Несогласованные факты расчёта.");
}

/** Audit provenance, not a second Score engine. The server simulation owns all scores. */
export const buildAnalysisFacts: AnalysisPort["buildAnalysisFacts"] = (input, catalog) => {
  const result = simulationResultSchema.parse(input);
  const data = gameDataSchema.parse(catalog);
  const { config } = data;
  verify(result.complete && result.modelVersion === config.modelVersion && result.datasetVersion === config.datasetVersion);
  verify(result.scenarioId === makeScenarioId(result));
  verify(result.decisions.length === config.directions.length);
  verify(new Set(result.decisions.map(d => d.direction)).size === config.directions.length);
  verify(new Set(result.decisions.map(d => d.initiativeId)).size === result.decisions.length);
  const selected = result.decisions.map(decision => {
    const initiative = data.initiatives.find(i => i.id === decision.initiativeId);
    verify(Boolean(initiative));
    verify(initiative!.direction === decision.direction && initiative!.eligibleDistrictIds.includes(decision.districtId));
    verify(data.districts.some(d => d.id === decision.districtId));
    return { decision, initiative: initiative! };
  });
  verify(result.budget.initial === config.budget);
  verify(result.budget.spent === selected.reduce((sum, s) => sum + s.initiative.cost, 0));
  verify(result.budget.remaining === result.budget.initial - result.budget.spent);
  verify(result.districts.length === data.districts.length && new Set(result.districts.map(d => d.districtId)).size === data.districts.length);
  verify(result.trace.length === data.districts.length * config.directions.length);
  verify(new Set(result.trace.map(t => `${t.districtId}:${t.metric}`)).size === result.trace.length);
  const expected = new Map<string, Omit<Fact, "label">>();
  const add = (fact: Omit<Fact, "label">) => { verify(!expected.has(fact.id)); expected.set(fact.id, fact); };
  add({ id: "budget:spent", kind: "budget", value: result.budget.spent, unit: config.currencyLabel });
  add({ id: "score:after", kind: "score", value: result.score.after, unit: "баллов" });
  for (const district of data.districts) {
    const values = result.districts.find(d => d.districtId === district.id);
    verify(Boolean(values));
    for (const metric of config.directions) {
      const trace = result.trace.find(t => t.districtId === district.id && t.metric === metric);
      verify(Boolean(trace));
      verify(trace!.baseline === district.baseline[metric] && values!.before[metric] === trace!.baseline);
      verify(trace!.after === values!.after[metric]);
      const effects = selected.flatMap(({ decision, initiative }) => decision.districtId === district.id
        ? initiative.effects.filter(e => e.metric === metric).map(e => ({ ...e, initiativeId: initiative.id })) : []);
      verify(trace!.contributions.length === effects.length);
      verify(new Set(trace!.contributions.map(c => `${c.initiativeId}:${c.ruleId}`)).size === effects.length);
      for (const contribution of trace!.contributions) {
        verify(effects.some(e => e.initiativeId === contribution.initiativeId && e.ruleId === contribution.ruleId && e.delta === contribution.delta));
        add({ id: `effect:${contribution.initiativeId}:${district.id}:${metric}`, kind: "effect", value: contribution.delta,
          unit: "баллов", districtId: district.id, initiativeId: contribution.initiativeId, ruleId: contribution.ruleId });
      }
      verify(trace!.rawAfter === trace!.baseline + trace!.contributions.reduce((sum, c) => sum + c.delta, 0));
      verify(trace!.after === Math.min(config.bounds.max, Math.max(config.bounds.min, trace!.rawAfter)));
      verify(trace!.clampAdjustment === trace!.after - trace!.rawAfter);
      add({ id: `district:${district.id}:${metric}:after`, kind: "metric", value: trace!.after, unit: "баллов", districtId: district.id });
    }
  }
  verify(result.facts.length === expected.size && new Set(result.facts.map(f => f.id)).size === expected.size);
  for (const fact of result.facts) {
    const reference = expected.get(fact.id);
    verify(Boolean(reference));
    for (const key of ["kind", "value", "unit", "districtId", "initiativeId", "ruleId"] as const) verify(fact[key] === reference![key]);
  }
  return result.facts;
};
