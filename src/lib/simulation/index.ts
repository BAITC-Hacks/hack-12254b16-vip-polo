import config from "@/data/config.json";
import districts from "@/data/districts.json";
import initiatives from "@/data/initiatives.json";
import { gameDataSchema, scenarioRequestSchema } from "@/shared/schema";
import { DIRECTIONS } from "@/shared/constants";
import { makeScenarioId } from "@/shared/scenario-id";
import type { SimulationPort } from "@/shared/ports";
import type { AppError, Fact, GameData, Metrics, MetricTrace } from "@/shared/types";

const failure = (error: AppError): { ok: false; error: AppError } => ({ ok: false, error });
const invalidData = () => failure({ code: "INTERNAL_ERROR", message: "Не удалось выполнить расчёт." });
const roundScore = (value: number) => Number(value.toFixed(2));

/** Cross-record checks complement the shared runtime shape schema. */
function checkData(data: GameData): boolean {
  const { config, districts, initiatives } = data;
  const districtIds = new Set(districts.map(d => d.id));
  const ruleIds = new Set<string>();
  if (districtIds.size !== districts.length || new Set(initiatives.map(i => i.id)).size !== initiatives.length) return false;
  if (config.directions.some((direction, index) => direction !== DIRECTIONS[index])) return false;
  if (config.bounds.min >= config.bounds.max) return false;
  // v1 defines an arithmetic mean: reject weights that would silently change it.
  if (Object.keys(config.districtWeights).length !== districts.length) return false;
  if (districts.some(d => config.districtWeights[d.id] !== 1 / districts.length)) return false;
  if (config.directions.some(m => config.metricWeights[m] !== 1 / config.directions.length)) return false;
  if (districts.some(d => config.directions.some(m => d.baseline[m] < config.bounds.min || d.baseline[m] > config.bounds.max))) return false;
  for (const initiative of initiatives) {
    if (new Set(initiative.eligibleDistrictIds).size !== initiative.eligibleDistrictIds.length) return false;
    if (initiative.eligibleDistrictIds.some(id => !districtIds.has(id))) return false;
    for (const effect of initiative.effects) {
      if (ruleIds.has(effect.ruleId)) return false;
      ruleIds.add(effect.ruleId);
    }
  }
  return true;
}

/** Parse on access so invalid server data is caught inside the route's error boundary. */
export const getGameData: SimulationPort["getGameData"] = () => {
  const data = gameDataSchema.parse({ config, districts, initiatives });
  if (!checkData(data)) throw new Error("Некорректный каталог модели.");
  // Zod returns fresh objects, including nested arrays and baseline metrics.
  return data;
};

export const validateScenario: SimulationPort["validateScenario"] = (input, data, mode) => {
  if (mode !== "draft" && mode !== "final") return failure({ code: "INVALID_REQUEST", message: "Неизвестный режим проверки." });
  const parsed = scenarioRequestSchema.safeParse(input);
  if (!parsed.success) return failure({ code: "INVALID_REQUEST", message: "Некорректная форма запроса или лишние поля." });
  const checkedData = gameDataSchema.safeParse(data);
  if (!checkedData.success || !checkData(checkedData.data)) return invalidData();
  const request = parsed.data;
  if (request.modelVersion !== data.config.modelVersion || request.datasetVersion !== data.config.datasetVersion) {
    return failure({ code: "VERSION_MISMATCH", message: "Версии модели или данных устарели. Обновите сценарий." });
  }
  const selectedIds = new Set<string>();
  const selectedDirections = new Set<string>();
  let spent = 0;
  for (const [index, decision] of request.decisions.entries()) {
    const field = `decisions.${index}`;
    if (selectedIds.has(decision.initiativeId)) return failure({ code: "DUPLICATE_INITIATIVE", message: "Мероприятие выбрано повторно.", field });
    if (selectedDirections.has(decision.direction)) return failure({ code: "DUPLICATE_DIRECTION", message: "Можно выбрать только одно мероприятие на направление.", field });
    selectedIds.add(decision.initiativeId);
    selectedDirections.add(decision.direction);
    if (!data.districts.some(d => d.id === decision.districtId)) return failure({ code: "UNKNOWN_DISTRICT", message: "Неизвестный район.", field });
    const initiative = data.initiatives.find(i => i.id === decision.initiativeId);
    if (!initiative) return failure({ code: "UNKNOWN_INITIATIVE", message: "Неизвестное мероприятие.", field });
    if (initiative.direction !== decision.direction) return failure({ code: "DIRECTION_MISMATCH", message: "Мероприятие относится к другому направлению.", field });
    if (!initiative.eligibleDistrictIds.includes(decision.districtId)) return failure({ code: "INCOMPATIBLE_DECISION", message: "Мероприятие недоступно в выбранном районе.", field });
    spent += initiative.cost;
  }
  if (mode === "final" && data.config.directions.some(direction => !selectedDirections.has(direction))) {
    return failure({ code: "INCOMPLETE_SCENARIO", message: "Нужно выбрать одно мероприятие по каждому направлению." });
  }
  if (spent > data.config.budget) return failure({ code: "BUDGET_EXCEEDED", message: "Стоимость сценария превышает бюджет", details: { budget: data.config.budget, spent } });
  request.decisions.sort((a, b) => data.config.directions.indexOf(a.direction) - data.config.directions.indexOf(b.direction));
  return { ok: true, data: request };
};

export const simulateScenario: SimulationPort["simulateScenario"] = (request, data, mode) => {
  const validation = validateScenario(request, data, mode);
  if (!validation.ok) return validation;
  const canonical = validation.data;
  const selected = canonical.decisions.map(decision => ({
    decision, initiative: data.initiatives.find(i => i.id === decision.initiativeId)!,
  }));
  const trace: MetricTrace[] = [];
  const resultDistricts = data.districts.map(district => {
    const after = { ...district.baseline };
    for (const metric of data.config.directions) {
      const contributions = selected.flatMap(({ decision, initiative }) => decision.districtId === district.id
        ? initiative.effects.filter(effect => effect.metric === metric).map(effect => ({ initiativeId: initiative.id, ruleId: effect.ruleId, delta: effect.delta }))
        : []);
      const baseline = district.baseline[metric];
      const rawAfter = baseline + contributions.reduce((sum, contribution) => sum + contribution.delta, 0);
      after[metric] = Math.min(data.config.bounds.max, Math.max(data.config.bounds.min, rawAfter));
      trace.push({ districtId: district.id, metric, baseline, contributions, rawAfter, after: after[metric], clampAdjustment: after[metric] - rawAfter });
    }
    return { districtId: district.id, before: { ...district.baseline }, after };
  });
  const averageCity = (phase: "before" | "after") => Object.fromEntries(data.config.directions.map(metric => [
    metric, resultDistricts.reduce((sum, district) => sum + district[phase][metric], 0) / resultDistricts.length,
  ])) as Metrics;
  const averageScore = (phase: "before" | "after") => resultDistricts.reduce((sum, district) =>
    sum + data.config.directions.reduce((total, metric) => total + district[phase][metric], 0), 0)
    / (resultDistricts.length * data.config.directions.length);
  const before = averageScore("before");
  const after = averageScore("after");
  const score = { before: roundScore(before), after: roundScore(after), delta: roundScore(after - before) };
  const spent = selected.reduce((sum, { initiative }) => sum + initiative.cost, 0);
  const facts: Fact[] = [
    { id: "budget:spent", kind: "budget", label: "Потрачено", value: spent, unit: data.config.currencyLabel },
    { id: "score:after", kind: "score", label: "Итоговая оценка", value: score.after, unit: "баллов" },
    ...trace.map(entry => ({ id: `district:${entry.districtId}:${entry.metric}:after`, kind: "metric" as const, label: `${entry.districtId}: ${entry.metric}`, value: entry.after, unit: "баллов", districtId: entry.districtId })),
    ...trace.flatMap(entry => entry.contributions.map(contribution => ({
      id: `effect:${contribution.initiativeId}:${entry.districtId}:${entry.metric}`,
      kind: "effect" as const, label: contribution.ruleId, value: contribution.delta, unit: "баллов",
      districtId: entry.districtId, initiativeId: contribution.initiativeId, ruleId: contribution.ruleId,
    }))),
  ];
  return { ok: true, data: {
    scenarioId: makeScenarioId(canonical), modelVersion: canonical.modelVersion, datasetVersion: canonical.datasetVersion,
    complete: canonical.decisions.length === data.config.directions.length, decisions: canonical.decisions,
    budget: { initial: data.config.budget, spent, remaining: data.config.budget - spent },
    districts: resultDistricts, city: { before: averageCity("before"), after: averageCity("after") }, score, trace, facts, warnings: [],
  } };
};
