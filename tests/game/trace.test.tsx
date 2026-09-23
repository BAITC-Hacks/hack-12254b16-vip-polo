// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { ScenarioTrace } from "@/features/game/ScenarioTrace";
import { directionLabels, formatNumber } from "@/features/game/labels";
import { getGameData } from "@/lib/simulation";
import type { SimulationResult } from "@/shared/types";
import { scenarios } from "../fixtures";

afterEach(cleanup);
function resultFor(name: "A" | "B" = "A"): SimulationResult {
  const expected = scenarios[name].expected;
  if (!expected.ok) throw new Error("A successful fixture is required");
  return structuredClone(expected.data);
}

it.each(["A", "B"] as const)("displays the supplied %s city metric pairs without duplicating district tables", name => {
  const data = getGameData();
  const result = resultFor(name);
  render(<ScenarioTrace result={result} data={data} />);
  const city = screen.getByRole("table", { name: "Город целиком" });
  for (const metric of data.config.directions) {
    const row = within(city).getByRole("rowheader", { name: directionLabels[metric] }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map(cell => cell.textContent)).toEqual([formatNumber(result.city.before[metric]), formatNumber(result.city.after[metric])]);
  }
  expect(screen.getAllByRole("table")).toHaveLength(1);
});

it("opens every trace entry and shows opposing B contributions, catalogue explanations and untouched districts", async () => {
  const result = resultFor("B");
  const data = getGameData();
  const user = userEvent.setup();
  render(<ScenarioTrace result={result} data={data} />);
  await user.click(screen.getByText("Откуда взялись числа"));
  let opened = 0;
  for (const entry of result.trace) {
    const districtName = data.districts.find(item => item.id === entry.districtId)!.name;
    const region = screen.getByRole("region", { name: `Разбор: ${districtName}` });
    const label = within(region).getByText(directionLabels[entry.metric]);
    await user.click(label);
    const details = label.closest("details")!;
    expect(details).toHaveAttribute("open");
    const trace = within(details);
    expect(trace.getByText("Исходное значение").nextElementSibling).toHaveTextContent(String(entry.baseline));
    expect(trace.getByText("Сумма до ограничения").nextElementSibling).toHaveTextContent(String(entry.rawAfter));
    expect(trace.getByText("Итоговый показатель").nextElementSibling).toHaveTextContent(String(entry.after));
    for (const contribution of entry.contributions) {
      const initiative = data.initiatives.find(item => item.id === contribution.initiativeId)!;
      const effect = initiative.effects.find(item => item.ruleId === contribution.ruleId)!;
      expect(trace.getByText(contribution.ruleId)).toBeVisible();
      expect(trace.getByText(initiative.title)).toBeVisible();
      expect(trace.getByText(effect.explanation)).toBeVisible();
    }
    if (!entry.contributions.length) expect(trace.getByText("Выбранные мероприятия не меняют этот показатель.")).toBeVisible();
    opened += 1;
  }
  expect(opened).toBe(15);
  const north = screen.getByRole("region", { name: "Разбор: Северный" });
  const transport = within(within(north).getByText("Транспорт").closest("details")!);
  expect(transport.getByText("transport-premium:gain")).toBeVisible();
  expect(transport.getByText("service-basic:tradeoff")).toBeVisible();
  expect(transport.getByText("+21")).toBeVisible();
  expect(transport.getByText("-1")).toBeVisible();
});

it.each([
  { rawAfter: 109, clampAdjustment: -9, after: 100, correction: "-9" },
  { rawAfter: -2, clampAdjustment: 2, after: 0, correction: "+2" },
])("renders a supplied clamp correction $correction without recalculating it", async ({ rawAfter, clampAdjustment, after, correction }) => {
  // Synthetic renderer inputs; the simulation tests own the clamp arithmetic.
  const result = resultFor();
  const entry = result.trace.find(item => item.districtId === "north" && item.metric === "transport")!;
  Object.assign(entry, { rawAfter, clampAdjustment, after });
  render(<ScenarioTrace result={result} data={getGameData()} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Откуда взялись числа"));
  const north = screen.getByRole("region", { name: "Разбор: Северный" });
  const label = within(north).getByText("Транспорт");
  await user.click(label);
  const trace = within(label.closest("details")!);
  expect(trace.getByText("Сумма до ограничения").nextElementSibling).toHaveTextContent(String(rawAfter));
  expect(trace.getByText("Поправка ограничения (clamp)").nextElementSibling).toHaveTextContent(correction);
  expect(trace.getByText("Итоговый показатель").nextElementSibling).toHaveTextContent(String(after));
});

it("uses the supplied catalogue and preserves both input objects while opening details", async () => {
  const data = getGameData();
  data.districts[0].name = "Тестовый север";
  data.initiatives.find(item => item.id === "transport-basic")!.title = "Название из переданных данных";
  const result = resultFor();
  const original = structuredClone({ data, result });
  render(<ScenarioTrace result={result} data={data} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Откуда взялись числа"));
  const district = screen.getByRole("region", { name: "Разбор: Тестовый север" });
  expect(within(district).getByRole("heading", { name: "Тестовый север район" })).toBeVisible();
  await user.click(within(district).getByText("Транспорт"));
  expect(within(district).getAllByText("Название из переданных данных")[0]).toBeVisible();
  expect({ data, result }).toEqual(original);
});

it.each(["modelVersion", "datasetVersion", "both"] as const)("keeps supplied numbers but hides catalogue metadata when %s differs", async version => {
  const data = getGameData();
  const result = resultFor("B");
  if (version === "modelVersion" || version === "both") data.config.modelVersion = "model-next";
  if (version === "datasetVersion" || version === "both") data.config.datasetVersion = "dataset-next";
  data.config.bounds = { min: 10, max: 90 };
  data.districts[0].name = "Район из другой версии";
  const initiative = data.initiatives.find(item => item.id === "transport-premium")!;
  initiative.title = "Название из другой версии";
  initiative.description = "Описание из другой версии";
  initiative.effects[0].explanation = "Объяснение из другой версии";
  // A new catalogue must not control even which stored metric rows are displayed.
  data.config.directions = ["transport"];
  const original = structuredClone({ data, result });

  render(<ScenarioTrace result={result} data={data} />);
  expect(screen.getByRole("status")).toHaveTextContent("Версии каталога и расчёта различаются");
  const city = screen.getByRole("table", { name: "Город целиком" });
  expect(within(city).getAllByRole("rowheader")).toHaveLength(5);
  const transportRow = within(city).getByRole("rowheader", { name: "Транспорт" }).closest("tr")!;
  expect(within(transportRow).getAllByRole("cell").map(cell => cell.textContent)).toEqual([
    formatNumber(result.city.before.transport), formatNumber(result.city.after.transport),
  ]);
  const user = userEvent.setup();
  await user.click(screen.getByText("Откуда взялись числа"));
  const north = screen.getByRole("region", { name: "Разбор: north" });
  await user.click(within(north).getByText("Транспорт"));
  const trace = within(within(north).getByText("Транспорт").closest("details")!);
  expect(trace.getByText("transport-premium")).toBeVisible();
  expect(trace.getByText("transport-premium:gain")).toBeVisible();
  expect(trace.getByText("+21")).toBeVisible();
  expect(trace.getByText("Сумма до ограничения").nextElementSibling).toHaveTextContent("60");
  expect(trace.getByText("Итоговый показатель").nextElementSibling).toHaveTextContent("60");
  expect(screen.queryByText(/из другой версии/)).not.toBeInTheDocument();
  expect(screen.queryByText(/10–90/)).not.toBeInTheDocument();
  expect({ data, result }).toEqual(original);
});

it("uses stored IDs for unknown districts and initiatives without losing trace values", async () => {
  const data = getGameData();
  data.districts = data.districts.filter(district => district.id !== "north");
  data.initiatives = data.initiatives.filter(initiative => initiative.id !== "transport-basic");
  const result = resultFor();
  render(<ScenarioTrace result={result} data={data} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Откуда взялись числа"));
  const north = screen.getByRole("region", { name: "Разбор: north" });
  await user.click(within(north).getByText("Транспорт"));
  const trace = within(within(north).getByText("Транспорт").closest("details")!);
  expect(trace.getByText("transport-basic")).toBeVisible();
  expect(trace.getByText("transport-basic:gain")).toBeVisible();
  expect(trace.getByText("+6")).toBeVisible();
  expect(trace.getByText("Итоговый показатель").nextElementSibling).toHaveTextContent("45");
  expect(screen.queryByRole("region", { name: "Разбор: Северный" })).not.toBeInTheDocument();
});
