// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsPanel } from "@/features/results";
import { createResultsExport } from "@/features/results/export";
import type { ResultsPanelProps } from "@/shared/ports";
import type { AIAnalysis, AnalysisUiState, SimulationResult } from "@/shared/types";
import { scenarios } from "../fixtures";

function fixture(): SimulationResult {
  if (!scenarios.A.expected.ok) throw new Error("Scenario A must have a simulation result");
  return structuredClone(scenarios.A.expected.data);
}

function aiAnalysis(result: SimulationResult): AIAnalysis {
  return {
    scenarioId: result.scenarioId, modelVersion: result.modelVersion, datasetVersion: result.datasetVersion,
    source: "ai", status: "ready", providerModel: "test-provider/test-model",
    summary: { text: "Тестовое объяснение результата.", factIds: ["score:after", "budget:spent"] },
    strengths: [{ text: "Сильная сторона тестового сценария.", factIds: ["district:north:transport:after"] }],
    risks: [{ text: "Риск требует внимания.", factIds: ["budget:spent"] }],
    tradeoffs: [{ text: "Есть модельный компромисс.", factIds: ["budget:spent"] }],
    recommendations: [{ text: "Сравните другой сценарий.", factIds: ["score:after"] }],
  };
}

function mount(state: AnalysisUiState = { status: "idle" }, result = fixture()) {
  const props: ResultsPanelProps = {
    result, analysisState: state, onRetryAnalysis: vi.fn(), onReplay: vi.fn(), onEdit: vi.fn(),
  };
  return { ...render(<ResultsPanel {...props} />), props };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ResultsPanel", () => {
  it("shows calculation numbers, district changes, facts and synthetic labels before AI is ready", () => {
    const result = fixture();
    mount({ status: "loading" }, result);
    const score = screen.getByRole("region", { name: "Astana Quality of Life Score" });
    expect(within(score).getByText("50")).toBeVisible();
    expect(within(score).getByText("51,67")).toBeVisible();
    expect(within(score).getByText("+1,67")).toBeVisible();
    const budget = screen.getByRole("region", { name: "Бюджет" });
    expect(within(budget).getByText("100")).toBeVisible();
    expect(within(budget).getAllByText("50")).toHaveLength(2);
    const north = screen.getByRole("table", { name: "Северный район" });
    const transport = within(north).getByRole("row", { name: "Транспорт 40 45 +5" });
    expect(transport).toBeVisible();
    expect(screen.getAllByRole("table")).toHaveLength(3);
    for (const fact of result.facts) expect(screen.getByText(fact.id)).toBeInTheDocument();
    expect(screen.getByText("Синтетические данные")).toBeVisible();
    expect(screen.getByText(/Score не является официальной оценкой/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Анализ выполняется…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Скачать JSON" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Редактировать решения" })).toBeEnabled();
  });

  it("renders all explanation sections with references to visible calculation facts", () => {
    const result = fixture();
    mount({ status: "ready", analysis: aiAnalysis(result) }, result);
    expect(screen.getByText("AI-анализ")).toBeVisible();
    for (const name of ["Сильные стороны", "Риски", "Компромиссы", "Что можно пересмотреть"]) {
      expect(screen.getByRole("heading", { name })).toBeVisible();
    }
    for (const link of screen.getAllByRole("link")) {
      const target = document.getElementById(link.getAttribute("href")!.slice(1));
      expect(target).not.toBeNull();
      expect(target).toHaveTextContent(link.textContent!.split(": ")[0]);
    }
  });

  it("does not use AI prose as numeric Score or budget output", () => {
    const result = fixture();
    const analysis = aiAnalysis(result);
    analysis.summary.text = "Непроверенный текст: Score 99, бюджет 999.";
    mount({ status: "ready", analysis }, result);
    const score = screen.getByRole("region", { name: "Astana Quality of Life Score" });
    expect(within(score).getByText("51,67")).toBeVisible();
    expect(within(score).queryByText(/99/)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Бюджет" })).not.toHaveTextContent("999");
  });

  it.each([
    ["unavailable", "AI недоступен."],
    ["timeout", "AI не ответил вовремя."],
    ["invalid_response", "Ответ AI не прошёл проверку."],
  ] as const)("marks fallback %s honestly and keeps retry available", (status, reason) => {
    const result = fixture();
    const analysis: AIAnalysis = { ...aiAnalysis(result), source: "fallback", status };
    mount({ status: "ready", analysis }, result);
    expect(screen.getByText("Fallback · без AI")).toBeVisible();
    expect(screen.getByText(new RegExp(reason))).toHaveTextContent("Это не ответ AI.");
    expect(screen.getByRole("button", { name: "Повторить AI-анализ" })).toBeEnabled();
    expect(screen.queryByText("AI-анализ")).not.toBeInTheDocument();
  });

  it("represents idle/error states and delegates actions without fetching", async () => {
    const fetch = vi.fn(() => { throw new Error("ResultsPanel must not fetch"); });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    const { props, rerender } = mount();
    expect(screen.getByText(/AI-анализ ещё не запущен/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Запустить AI-анализ" }));
    expect(props.onRetryAnalysis).toHaveBeenCalledTimes(1);
    rerender(<ResultsPanel {...props} analysisState={{ status: "error", message: "Сервер недоступен." }} />);
    expect(screen.getByText(/Сервер недоступен/)).toHaveTextContent("Расчёт сохранён.");
    await user.click(screen.getByRole("button", { name: "Повторить AI-анализ" }));
    await user.click(screen.getByRole("button", { name: "Редактировать решения" }));
    await user.click(screen.getByRole("button", { name: "Новая игра" }));
    expect(props.onRetryAnalysis).toHaveBeenCalledTimes(2);
    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onReplay).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("supports keyboard retry and announces loading without a busy ancestor suppressing the status", async () => {
    const user = userEvent.setup();
    const { props, rerender } = mount();
    await user.tab();
    expect(screen.getByRole("button", { name: "Запустить AI-анализ" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(props.onRetryAnalysis).toHaveBeenCalledOnce();
    rerender(<ResultsPanel {...props} analysisState={{ status: "loading" }} />);
    const loadingStatus = within(screen.getByRole("region", { name: "Объяснение результатов" })).getByRole("status");
    expect(loadingStatus).toHaveTextContent("Готовим AI-анализ…");
    expect(loadingStatus).toHaveAttribute("aria-live", "polite");
    expect(loadingStatus.closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Анализ выполняется…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Анализ выполняется…" }));
    expect(props.onRetryAnalysis).toHaveBeenCalledOnce();
  });

  it.each(["scenarioId", "modelVersion", "datasetVersion"] as const)("hides and omits stale analysis with different %s", field => {
    const result = fixture();
    const analysis = { ...aiAnalysis(result), [field]: "outdated" };
    mount({ status: "ready", analysis }, result);
    expect(screen.getByText(/Объяснение не соответствует/)).toBeVisible();
    expect(screen.queryByText(analysis.summary.text)).not.toBeInTheDocument();
    expect(createResultsExport(result, { status: "ready", analysis })).toMatchObject({ simulation: result, analysis: null, analysisUiStatus: "error" });
  });

  it("exports actual calculation, complete trace, facts and honest explanation source", async () => {
    const result = fixture();
    const analysis: AIAnalysis = { ...aiAnalysis(result), source: "fallback", status: "timeout" };
    mount({ status: "ready", analysis }, result);
    let blob: Blob | undefined;
    const createUrl = vi.fn((value: Blob) => { blob = value; return "blob:test-results"; });
    const revokeUrl = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this).toHaveAttribute("download", "akim-results.json");
      expect(this).toHaveAttribute("href", "blob:test-results");
      expect(this.isConnected).toBe(true);
    });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Скачать JSON" }));
    expect(click).toHaveBeenCalledOnce();
    expect(blob?.type).toBe("application/json;charset=utf-8");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revokeUrl).toHaveBeenCalledWith("blob:test-results");
    vi.useRealTimers();
    const contents = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob!);
    });
    expect(JSON.parse(contents)).toEqual({
      exportVersion: 1, synthetic: true,
      disclaimer: "Учебная модель условных районов. Score не является официальной оценкой Астаны.",
      simulation: result, analysis, analysisUiStatus: "ready",
    });
    expect(screen.getByText("JSON-файл подготовлен к скачиванию.")).toBeVisible();
  });

  it.each(["idle", "loading", "error"] as const)("exports the calculation while analysis is %s", status => {
    const result = fixture();
    const state: AnalysisUiState = status === "error" ? { status, message: "Unavailable" } : { status };
    expect(createResultsExport(result, state)).toMatchObject({ simulation: result, analysis: null, analysisUiStatus: status, synthetic: true });
  });

  it("handles unavailable download APIs without losing the result", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Скачать JSON" }));
    expect(screen.getByText("Не удалось скачать JSON. Попробуйте ещё раз.")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Astana Quality of Life Score" })).getByText("51,67")).toBeVisible();
  });
});
