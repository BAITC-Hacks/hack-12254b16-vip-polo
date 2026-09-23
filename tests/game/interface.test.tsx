// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GameShell, CityMap, InitiativePicker } from "@/features/game";
import { getGameData } from "@/lib/simulation";
import type { SimulationResult } from "@/shared/types";
import { scenarios } from "../fixtures";

// Exercise the unavailable state independently of when participant 2 merges.
vi.mock("@/lib/simulation", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/simulation")>(),
  simulateScenario: vi.fn(() => ({ ok: false, error: { code: "NOT_IMPLEMENTED", message: "Расчёт ещё не подключён" } }))
}));

afterEach(cleanup);
const data = getGameData();
const title = (id: string) => data.initiatives.find(item => item.id === id)!.title;
const resultC = (scenarios.C.expected as { ok: true; data: SimulationResult }).data;
it("selects districts with Enter and Space and exposes the pressed state", async () => {
  const user = userEvent.setup(); const select = vi.fn();
  render(<CityMap districts={data.districts} selectedDistrictId="north" preview={null} onSelectDistrict={select} />);
  const center = screen.getByRole("button", { name: "Центральный район" }); center.focus();
  await user.keyboard("{Enter}"); expect(select).toHaveBeenLastCalledWith("center");
  const south = screen.getByRole("button", { name: "Южный район" }); south.focus();
  await user.keyboard(" "); expect(select).toHaveBeenLastCalledWith("south");
  expect(screen.getByRole("button", { name: "Северный район" })).toHaveAttribute("aria-pressed", "true");
});
it("allows a validated replacement at zero current remaining budget and shows the new remainder", async () => {
  const select = vi.fn(); const user = userEvent.setup();
  const replacement = { ...structuredClone(resultC), budget: { initial: 100, spent: 90, remaining: 10 } };
  render(<InitiativePicker initiatives={data.initiatives} direction="transport" districtId="north" selectedInitiativeId="transport-standard" remainingBudget={0} onSelect={select} onRemove={vi.fn()}
    candidates={{ "transport-basic": { ok: true, data: replacement } }} />);
  const replace = screen.getByRole("button", { name: `Заменить: ${title("transport-basic")}` });
  expect(replace).toBeEnabled(); await user.click(replace); expect(select).toHaveBeenCalledWith("transport-basic");
  expect(screen.getByText(/Останется после выбора:/)).toHaveTextContent("10 ед.");
});
it("prevents a candidate rejected by the budget port without blocking an affordable replacement", async () => {
  const select = vi.fn(); const user = userEvent.setup();
  render(<InitiativePicker initiatives={data.initiatives} direction="transport" districtId="north" selectedInitiativeId="transport-standard" remainingBudget={0} onSelect={select} onRemove={vi.fn()}
    candidates={{
      "transport-standard": { ok: true, data: resultC },
      "transport-premium": { ok: false, error: { code: "BUDGET_EXCEEDED", message: "Бюджет превышен" } }
    }} />);
  const blocked = screen.getByRole("button", { name: `Заменить: ${title("transport-premium")}` });
  expect(blocked).toBeDisabled(); await user.click(blocked); expect(select).not.toHaveBeenCalled();
  expect(screen.getByText(/Не помещается в бюджет/)).toBeVisible();
  expect(screen.getByRole("button", { name: `Выбрано: ${title("transport-standard")}` })).toBeEnabled();
  expect(screen.getByText(/Остаток бюджета:/)).toHaveTextContent("0 ед.");
});
it("shows both the gain and the tradeoff before expanding initiative details", () => {
  render(<InitiativePicker initiatives={data.initiatives} direction="transport" districtId="north" selectedInitiativeId={null} remainingBudget={100} onSelect={vi.fn()} onRemove={vi.fn()} />);
  const effects = screen.getAllByRole("list", { name: "Изменения показателей" })[0];
  expect(within(effects).getByText("+6")).toBeVisible();
  expect(within(effects).getByText("-1")).toBeVisible();
  expect(effects).toHaveTextContent("Транспорт");
  expect(effects).toHaveTextContent("Озеленение");
  expect(screen.getAllByText("Что изменится")[0].parentElement).not.toHaveAttribute("open");
});
it("keeps unavailable calculations selectable but respects district eligibility", () => {
  const initiatives = data.initiatives.map(item => item.id === "transport-premium" ? { ...item, eligibleDistrictIds: ["south"] } : item);
  render(<InitiativePicker initiatives={initiatives} direction="transport" districtId="north" selectedInitiativeId={null} remainingBudget={0} onSelect={vi.fn()} onRemove={vi.fn()}
    candidates={{ "transport-basic": { ok: false, error: { code: "NOT_IMPLEMENTED", message: "Расчёт ещё не подключён" } } }} />);
  expect(screen.getByRole("button", { name: `Выбрать: ${title("transport-basic")}` })).toBeEnabled();
  expect(screen.getByRole("button", { name: `Выбрать: ${title("transport-premium")}` })).toBeDisabled();
  expect(screen.getByText("Недоступно для выбранного района")).toBeVisible();
  expect(screen.queryByText(/Останется после выбора:/)).not.toBeInTheDocument();
});
it("builds, replaces, relocates and removes a draft without pretending the scaffold can calculate", async () => {
  const user = userEvent.setup(); render(<GameShell data={data} />);
  expect(screen.getByRole("button", { name: /Завершить сценарий/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: `Выбрать: ${title("transport-basic")}` }));
  const plan = screen.getByRole("region", { name: "Ваши решения" });
  expect(within(plan).getAllByRole("listitem")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: `Заменить: ${title("transport-premium")}` }));
  expect(within(plan).getAllByRole("listitem")).toHaveLength(1);
  expect(within(plan).getByText(`${title("transport-premium")} · Северный`)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Южный район" }));
  await user.click(screen.getByRole("button", { name: `Заменить: ${title("transport-basic")}` }));
  expect(within(plan).getByText(`${title("transport-basic")} · Южный`)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Удалить: Транспорт" }));
  expect(within(plan).queryAllByRole("listitem")).toHaveLength(0);
  expect(screen.getByText(/Бюджет и последствия пока не проверяются/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: `Выбрать: ${title("transport-basic")}` }));
  await user.click(screen.getByRole("button", { name: "Начать заново" }));
  expect(within(plan).queryAllByRole("listitem")).toHaveLength(0);
});
it("advances to the next undecided direction and edits a plan item in its original district", async () => {
  const user = userEvent.setup(); render(<GameShell data={data} />);
  await user.click(screen.getByRole("button", { name: "Южный район" }));
  await user.click(screen.getByRole("button", { name: `Выбрать: ${title("transport-basic")}` }));
  await user.click(screen.getByRole("button", { name: /Далее: Озеленение/ }));
  expect(screen.getByRole("heading", { name: "Озеленение", level: 3 })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Центральный район" }));
  await user.click(screen.getByRole("button", { name: "Изменить: Транспорт" }));
  expect(screen.getByRole("heading", { name: "Транспорт", level: 3 })).toBeVisible();
  expect(screen.getByRole("button", { name: "Южный район" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: `Выбрано: ${title("transport-basic")}` })).toHaveAttribute("aria-pressed", "true");
});
it("preserves keyboard focus when the next-direction button disappears", async () => {
  const user = userEvent.setup(); render(<GameShell data={data} />);
  await user.click(screen.getByRole("button", { name: `Выбрать: ${title("transport-basic")}` }));
  const next = screen.getByRole("button", { name: /Далее: Озеленение/ });
  next.focus();
  await user.keyboard("{Enter}");
  expect(next).not.toBeInTheDocument();
  const direction = within(screen.getByRole("group", { name: "Направления" })).getByRole("button", { name: /Озеленение/ });
  expect(direction).toHaveAttribute("aria-pressed", "true");
  expect(direction).toHaveFocus();
});
