// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResultsPanel } from "@/features/results";
import { getGameData } from "@/lib/simulation";
import type { ResultsPanelProps } from "@/shared/ports";
import type { AIAnalysis, SimulationResult } from "@/shared/types";
import { scenarios } from "../fixtures";

afterEach(cleanup);

function resultFor(name: "A" | "B" | "C" | "E" = "A"): SimulationResult {
  const expected = scenarios[name].expected;
  if (!expected.ok) throw new Error("A successful fixture is required");
  return structuredClone(expected.data);
}

function props(overrides: Partial<ResultsPanelProps> = {}): ResultsPanelProps {
  return { result: resultFor(), analysisState: { status: "idle" }, onRetryAnalysis: vi.fn(), onReplay: vi.fn(), onEdit: vi.fn(), ...overrides };
}

function analysisFor(result: SimulationResult, overrides: Partial<AIAnalysis> = {}): AIAnalysis {
  return {
    scenarioId: result.scenarioId, modelVersion: result.modelVersion, datasetVersion: result.datasetVersion,
    source: "ai", status: "ready", summary: { text: "Результат связан с проверенными фактами.", factIds: ["score:after", "budget:spent"] },
    strengths: [{ text: "Изменились показатели района.", factIds: ["district:north:transport:after"] }],
    risks: [], tradeoffs: [], recommendations: [], ...overrides,
  };
}

describe("ResultsPanel", () => {
  it.each([[
    "A", "51,67", "50", "+1,67 балла",
  ], ["B", "52,53", "70", "+2,53 балла"], ["C", "53,33", "100", "+3,33 балла"]] as const)("shows the supplied %s score, budget and all district metrics", (name, score, spent, delta) => {
    render(<ResultsPanel {...props({ result: resultFor(name) })} />);
    const scorePanel = within(screen.getByRole("region", { name: "Итоговый Score" }));
    expect(scorePanel.getByText(score, { exact: false })).toBeVisible();
    expect(scorePanel.getByText(delta)).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Использованный бюджет" })).toHaveAttribute("value", spent);
    expect(screen.getByRole("table", { name: "Город целиком" })).toBeVisible();
    for (const district of getGameData().districts) {
      expect(within(screen.getByRole("table", { name: `${district.name} район` })).getAllByRole("row")).toHaveLength(6);
    }
    expect(screen.getByText("Все направления включены в план")).toBeVisible();
  });

  it("presents every supplied score value without calculating a substitute", () => {
    const result = resultFor();
    result.score = { before: 30, after: 27.25, delta: -2.75 };
    render(<ResultsPanel {...props({ result })} />);
    const score = within(screen.getByRole("region", { name: "Итоговый Score" }));
    expect(score.getByText("27,25", { exact: false })).toBeVisible();
    expect(score.getByText("Было 30")).toBeVisible();
    expect(score.getByText("-2,75 балла")).toBeVisible();
  });

  it("distinguishes an incomplete draft and keeps the supplied object intact", () => {
    const result = resultFor("E");
    const before = structuredClone(result);
    render(<ResultsPanel {...props({ result })} />);
    expect(screen.getByText(/Промежуточный результат/)).toBeVisible();
    expect(result).toEqual(before);
  });

  it("explains every rule, including both opposing contributions, raw sum and clamp", async () => {
    const result = resultFor("B");
    render(<ResultsPanel {...props({ result })} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Откуда взялись числа"));
    const north = within(screen.getByRole("region", { name: "Разбор: Северный" }));
    await user.click(north.getByText("Транспорт"));
    const transport = north.getByText("Транспорт").closest("details");
    expect(transport).toHaveAttribute("open");
    const detail = within(transport!);
    expect(detail.getByText("transport-premium:gain")).toBeVisible();
    expect(detail.getByText("service-basic:tradeoff")).toBeVisible();
    expect(detail.getByText("+21")).toBeVisible();
    expect(detail.getByText("-1")).toBeVisible();
    expect(detail.getByText("Сумма до ограничения").nextElementSibling).toHaveTextContent("60");
    expect(detail.getByText("Поправка ограничения (clamp)").nextElementSibling).toHaveTextContent("0");
    for (const entry of result.trace) for (const contribution of entry.contributions) {
      expect(screen.getByText(contribution.ruleId)).toBeInTheDocument();
    }
    for (const decision of result.decisions) {
      const initiative = getGameData().initiatives.find(item => item.id === decision.initiativeId)!;
      expect(screen.getAllByText(initiative.description).length).toBeGreaterThan(0);
    }
  });

  it("shows the provided nonzero clamp adjustment and does not recompute it", async () => {
    const result = resultFor();
    const entry = result.trace.find(item => item.districtId === "north" && item.metric === "transport")!;
    entry.rawAfter = 109; entry.clampAdjustment = -9; entry.after = 100;
    render(<ResultsPanel {...props({ result })} />);
    await userEvent.click(screen.getByText("Откуда взялись числа"));
    const north = within(screen.getByRole("region", { name: "Разбор: Северный" }));
    await userEvent.click(north.getByText("Транспорт"));
    const detail = within(north.getByText("Транспорт").closest("details")!);
    expect(detail.getByText("Сумма до ограничения").nextElementSibling).toHaveTextContent("109");
    expect(detail.getByText("Поправка ограничения (clamp)").nextElementSibling).toHaveTextContent("-9");
    expect(detail.getByText("Итоговый показатель").nextElementSibling).toHaveTextContent("100");
  });

  it("keeps the calculation visible while AI loads and offers retry after failure", async () => {
    const handlers = props({ analysisState: { status: "loading" } });
    const view = render(<ResultsPanel {...handlers} />);
    expect(screen.getByRole("status")).toHaveTextContent("Готовим объяснение");
    expect(screen.getByRole("region", { name: "Итоговый Score" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /AI-анализ/ })).not.toBeInTheDocument();
    view.rerender(<ResultsPanel {...handlers} analysisState={{ status: "error", message: "Сервис ещё не подключён." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Сервис ещё не подключён.");
    expect(screen.getByRole("region", { name: "Итоговый Score" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Повторить AI-анализ" }));
    expect(handlers.onRetryAnalysis).toHaveBeenCalledOnce();
  });

  it("renders analysis as text and reveals facts with the exact supplied values", async () => {
    const result = resultFor();
    const injection = '<img src="x" onerror="alert(1)"><script>alert(1)</script>';
    const analysis = analysisFor(result, { summary: { text: injection, factIds: ["score:after", "budget:spent"] } });
    const { container } = render(<ResultsPanel {...props({ result, analysisState: { status: "ready", analysis } })} />);
    expect(screen.getByText(injection)).toBeVisible();
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.getByText("Объяснение AI")).toBeVisible();
    await userEvent.click(screen.getByText("Факты в основе вывода (2)"));
    expect(screen.getByText("51,67 баллов")).toBeVisible();
    expect(screen.getByText("score:after")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Повторить AI-анализ" })).not.toBeInTheDocument();
  });

  it.each(["scenarioId", "modelVersion", "datasetVersion", "factIds", "source"] as const)("rejects analysis with mismatched %s without hiding results", field => {
    const result = resultFor();
    const analysis = analysisFor(result);
    if (field === "factIds") analysis.summary.factIds = ["unknown:fact"];
    else if (field === "source") analysis.source = "fallback";
    else analysis[field] = "different";
    render(<ResultsPanel {...props({ result, analysisState: { status: "ready", analysis } })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Объяснение не соответствует");
    expect(screen.queryByText(analysis.summary.text)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Итоговый Score" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Повторить AI-анализ" })).toBeVisible();
  });

  it("labels received fallback honestly and exposes retry and replay callbacks", async () => {
    const result = resultFor();
    const analysis = analysisFor(result, { source: "fallback", status: "timeout" });
    const handlers = props({ result, analysisState: { status: "ready", analysis } });
    render(<ResultsPanel {...handlers} />);
    expect(screen.getByText("Резервное объяснение · AI недоступен")).toBeVisible();
    expect(screen.getByText(/Сервис не ответил вовремя/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Повторить AI-анализ" }));
    await userEvent.click(screen.getByRole("button", { name: "Новый сценарий" }));
    expect(handlers.onRetryAnalysis).toHaveBeenCalledOnce();
    expect(handlers.onReplay).toHaveBeenCalledOnce();
    expect(handlers.onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Редакт/ })).not.toBeInTheDocument();
  });
});
