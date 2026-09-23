// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGameData, simulateScenario } from "@/lib/simulation";
import { useGame } from "@/features/game/useGame";
import { GameShell } from "@/features/game";
import { makeScenarioId } from "@/shared/scenario-id";
import type { AIAnalysis, SimulationResult } from "@/shared/types";
import { scenarios } from "../fixtures";

vi.mock("@/lib/simulation", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/simulation")>(), simulateScenario: vi.fn() }));
const data = getGameData();
const title = (id: string) => data.initiatives.find(item => item.id === id)!.title;
const simulate = vi.mocked(simulateScenario);
const fetchMock = vi.fn<typeof fetch>();
const resultA = (scenarios.A.expected as { ok: true; data: SimulationResult }).data;
const resultB = (scenarios.B.expected as { ok: true; data: SimulationResult }).data;
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function analysis(result: SimulationResult, source: "ai" | "fallback" = "ai"): AIAnalysis {
  return { scenarioId: result.scenarioId, modelVersion: result.modelVersion, datasetVersion: result.datasetVersion,
    source, status: source === "ai" ? "ready" : "unavailable", summary: { text: "Тестовое объяснение", factIds: ["score:after"] }, strengths: [], risks: [], tradeoffs: [], recommendations: [] };
}
function setup(request = scenarios.A.request) {
  const hook = renderHook(() => useGame(data));
  for (const decision of request.decisions) act(() => hook.result.current.select(decision));
  return hook;
}
beforeEach(() => {
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  // Canned port responses exercise the container, not participant 2's model.
  simulate.mockReset(); simulate.mockImplementation((request, _data, mode) => {
    if (mode === "final" && request.decisions.length !== 5) return { ok: false, error: { code: "INCOMPLETE_SCENARIO", message: "Выберите пять решений" } };
    const known = Object.values(scenarios).find(fixture => makeScenarioId(fixture.request) === makeScenarioId(request));
    if (known) return known.expected;
    return { ok: true, data: { ...structuredClone(resultA), scenarioId: makeScenarioId(request), decisions: request.decisions, complete: false } };
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("replaces a decision at zero remaining budget through the shared port and restores A/B", () => {
  const hook = setup(scenarios.C.request);
  expect(hook.result.current.preview?.budget.remaining).toBe(0);
  act(() => hook.result.current.select(scenarios.C.request.decisions[0]));
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.decisions).toHaveLength(5);
  expect(simulate).toHaveBeenLastCalledWith(expect.objectContaining({ decisions: expect.arrayContaining(scenarios.C.request.decisions) }), data, "draft");
  for (const decision of scenarios.A.request.decisions) act(() => hook.result.current.select(decision));
  act(() => hook.result.current.select(scenarios.B.request.decisions[0]));
  expect(hook.result.current.preview?.score.after).toBe(52.53);
  act(() => hook.result.current.select(scenarios.A.request.decisions[0]));
  expect(hook.result.current.preview?.score.after).toBe(51.67);
  act(() => hook.result.current.remove("service"));
  expect(hook.result.current.preview?.budget.spent).toBe(40);
  expect(hook.result.current.preview?.complete).toBe(false);
  act(() => hook.result.current.select(scenarios.A.request.decisions[4]));
  expect(hook.result.current.preview).toEqual(resultA);
});

it("rejects a budget error without changing the existing plan", () => {
  const hook = setup();
  simulate.mockReturnValueOnce({ ok: false, error: { code: "BUDGET_EXCEEDED", message: "Бюджет превышен" } });
  act(() => hook.result.current.select(scenarios.B.request.decisions[0]));
  expect(hook.result.current.decisions).toEqual(scenarios.A.request.decisions);
  expect(hook.result.current.error).toBe("Бюджет превышен");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("blocks incomplete final requests without any network call", async () => {
  const hook = setup(scenarios.E.request);
  await act(() => hook.result.current.finish());
  expect(hook.result.current.error).toBe("Выберите пять решений");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("shows the server result before analysis, deduplicates finish and sends only the request", async () => {
  const ai = deferred<Response>();
  fetchMock.mockResolvedValueOnce(response({ ok: true, data: resultA })).mockReturnValueOnce(ai.promise);
  const hook = setup(); let pending!: Promise<void>;
  await act(async () => { pending = hook.result.current.finish(); await hook.result.current.finish(); });
  expect(hook.result.current.result).toEqual(resultA);
  expect(hook.result.current.analysisState.status).toBe("loading");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/simulate", "/api/analysis"]);
  for (const [, options] of fetchMock.mock.calls) expect(JSON.parse(options?.body as string)).toEqual(scenarios.A.request);
  await act(async () => { ai.resolve(response({ ok: true, data: { simulation: resultA, analysis: analysis(resultA) } })); await pending; });
  expect(hook.result.current.analysisState).toMatchObject({ status: "ready", analysis: { source: "ai" } });
});

it("keeps the simulation after AI failure and retries only analysis with a labelled fallback", async () => {
  fetchMock.mockResolvedValueOnce(response({ ok: true, data: resultA })).mockRejectedValueOnce(new Error("Нет связи"))
    .mockResolvedValueOnce(response({ ok: true, data: { simulation: resultA, analysis: analysis(resultA, "fallback") } }));
  const hook = setup();
  await act(() => hook.result.current.finish());
  expect(hook.result.current.result).toEqual(resultA);
  expect(hook.result.current.analysisState).toMatchObject({ status: "error" });
  await act(() => hook.result.current.retryAnalysis());
  expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/simulate", "/api/analysis", "/api/analysis"]);
  expect(hook.result.current.analysisState).toMatchObject({ status: "ready", analysis: { source: "fallback", status: "unavailable" } });
  act(() => hook.result.current.edit());
  expect(hook.result.current.result).toBeNull();
  expect(hook.result.current.decisions).toHaveLength(5);
  act(() => hook.result.current.replay());
  expect(hook.result.current.decisions).toEqual([]);
  expect(hook.result.current.analysisState.status).toBe("idle");
});

it("ignores an old simulation even after returning to the same scenario", async () => {
  const old = deferred<Response>(); fetchMock.mockReturnValueOnce(old.promise);
  const hook = setup(); let pending!: Promise<void>;
  act(() => { pending = hook.result.current.finish(); });
  act(() => hook.result.current.select(scenarios.B.request.decisions[0]));
  act(() => hook.result.current.select(scenarios.A.request.decisions[0]));
  expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  await act(async () => { old.resolve(response({ ok: true, data: resultA })); await pending; });
  expect(hook.result.current.result).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("ignores stale AI success without overwriting a newer scenario", async () => {
  const old = deferred<Response>();
  fetchMock.mockResolvedValueOnce(response({ ok: true, data: resultA })).mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response({ ok: true, data: resultB }))
    .mockResolvedValueOnce(response({ ok: true, data: { simulation: resultB, analysis: analysis(resultB) } }));
  const hook = setup(); let pending!: Promise<void>;
  await act(async () => { pending = hook.result.current.finish(); });
  act(() => hook.result.current.select(scenarios.B.request.decisions[0]));
  await act(() => hook.result.current.finish());
  await act(async () => { old.resolve(response({ ok: true, data: { simulation: resultA, analysis: analysis(resultA) } })); await pending; });
  expect(hook.result.current.result).toEqual(resultB);
  expect(hook.result.current.analysisState).toMatchObject({ status: "ready", analysis: { scenarioId: resultB.scenarioId } });
});

it("aborts pending requests on unmount", async () => {
  const old = deferred<Response>(); fetchMock.mockReturnValueOnce(old.promise);
  const hook = setup(); let pending!: Promise<void>;
  act(() => { pending = hook.result.current.finish(); }); hook.unmount();
  expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  old.resolve(response({ ok: true, data: resultA })); await pending;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("ignores a stale AI failure after replay", async () => {
  const old = deferred<Response>();
  fetchMock.mockResolvedValueOnce(response({ ok: true, data: resultA })).mockReturnValueOnce(old.promise);
  const hook = setup(); let pending!: Promise<void>;
  await act(async () => { pending = hook.result.current.finish(); });
  act(() => hook.result.current.replay());
  await act(async () => { old.resolve(response({ ok: false, error: { code: "INTERNAL_ERROR", message: "Старый сбой" } }, 500)); await pending; });
  expect(hook.result.current.result).toBeNull();
  expect(hook.result.current.analysisState.status).toBe("idle");
  expect(hook.result.current.error).toBeNull();
});

it("connects the UI completion, immediate result, retry and edit callbacks", async () => {
  fetchMock.mockResolvedValueOnce(response({ ok: true, data: resultA })).mockRejectedValueOnce(new Error("Нет связи"))
    .mockResolvedValueOnce(response({ ok: true, data: { simulation: resultA, analysis: analysis(resultA, "fallback") } }));
  const user = userEvent.setup(); render(<GameShell data={data} />);
  const directions = screen.getByRole("group", { name: "Направления" });
  for (const [index, button] of within(directions).getAllByRole("button").entries()) {
    await user.click(button);
    await user.click(screen.getByRole("button", { name: `Выбрать: ${title(`${data.config.directions[index]}-basic`)}` }));
  }
  const finish = screen.getByRole("button", { name: /Завершить сценарий/ });
  expect(finish).toBeEnabled(); await user.click(finish);
  expect(await screen.findByRole("heading", { name: "Сценарий рассчитан" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("AI-анализ сейчас недоступен.");
  expect(screen.getByRole("alert")).toHaveTextContent("Нет связи");
  expect(screen.getByRole("region", { name: "Состояние сценария" })).toHaveTextContent("51,67");
  await user.click(screen.getByRole("button", { name: "Повторить AI-анализ" }));
  expect(await screen.findByText("Резервное объяснение · AI недоступен")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Редактировать решения" }));
  expect(screen.queryByRole("region", { name: "Итог сценария" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Ваши решения" })).getAllByRole("listitem")).toHaveLength(5);
});

it("cancels the session if the server supplies a new dataset version", async () => {
  const old = deferred<Response>(); fetchMock.mockReturnValueOnce(old.promise);
  const user = userEvent.setup(); const view = render(<GameShell data={data} />);
  for (const [index, button] of within(screen.getByRole("group", { name: "Направления" })).getAllByRole("button").entries()) {
    await user.click(button); await user.click(screen.getByRole("button", { name: `Выбрать: ${title(`${data.config.directions[index]}-basic`)}` }));
  }
  await user.click(screen.getByRole("button", { name: /Завершить сценарий/ }));
  view.rerender(<GameShell data={{ ...data, config: { ...data.config, datasetVersion: "synthetic-v2" } }} />);
  expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  await act(async () => { old.resolve(response({ ok: true, data: resultA })); });
  expect(screen.queryByRole("region", { name: "Итог сценария" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Ваши решения" })).queryAllByRole("listitem")).toHaveLength(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

describe("response boundaries", () => {
  it.each([
    { ...resultA, scenarioId: "old" }, { ...resultA, modelVersion: "model-v0" },
    { ...resultA, datasetVersion: "synthetic-v0" }, { ...resultA, complete: false },
    { ...resultA, decisions: scenarios.B.request.decisions }
  ])("rejects a mismatched simulation", async result => {
    fetchMock.mockResolvedValueOnce(response({ ok: true, data: result })); const hook = setup();
    await act(() => hook.result.current.finish());
    expect(hook.result.current.result).toBeNull(); expect(hook.result.current.error).toMatch(/другому сценарию/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    { simulation: resultB, analysis: analysis(resultA) },
    { simulation: resultA, analysis: { ...analysis(resultA), scenarioId: "old" } },
    { simulation: resultA, analysis: { ...analysis(resultA), datasetVersion: "synthetic-v0" } }
  ])("rejects a mismatched analysis and retains the result", async payload => {
    fetchMock.mockResolvedValueOnce(response({ ok: true, data: resultA })).mockResolvedValueOnce(response({ ok: true, data: payload }));
    const hook = setup(); await act(() => hook.result.current.finish());
    expect(hook.result.current.result).toEqual(resultA);
    expect(hook.result.current.analysisState).toMatchObject({ status: "error", message: expect.stringMatching(/другому сценарию/) });
  });
  it.each([response({ score: 99 }), response({ ok: true, data: resultA }, 500), response({ ok: false, error: { code: "BUDGET_EXCEEDED", message: "Бюджет превышен" } }, 422)])("rejects invalid/server-error responses", async reply => {
    fetchMock.mockResolvedValueOnce(reply); const hook = setup(); await act(() => hook.result.current.finish());
    expect(hook.result.current.result).toBeNull(); expect(hook.result.current.error).toBeTruthy(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

it("allows a clearly unverified draft but never finishes when the simulation is unavailable", async () => {
  simulate.mockReturnValue({ ok: false, error: { code: "NOT_IMPLEMENTED", message: "Расчёт не подключён" } });
  const hook = setup(); expect(hook.result.current.decisions).toHaveLength(5);
  expect(hook.result.current.preview).toBeNull(); expect(hook.result.current.unavailable).toBe(true);
  await act(() => hook.result.current.finish()); expect(fetchMock).not.toHaveBeenCalled();
});
