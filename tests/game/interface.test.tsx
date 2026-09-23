// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { GameShell, CityMap, InitiativePicker } from "@/features/game";
import { getGameData } from "@/lib/simulation";

// Exercise the unavailable state independently of when participant 2 merges.
vi.mock("@/lib/simulation", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/simulation")>(),
  simulateScenario: vi.fn(() => ({ ok: false, error: { code: "NOT_IMPLEMENTED", message: "Расчёт ещё не подключён" } }))
}));

afterEach(cleanup);
const data = getGameData();
it("selects districts with Enter and Space and exposes the pressed state", async () => {
  const user = userEvent.setup(); const select = vi.fn();
  render(<CityMap districts={data.districts} selectedDistrictId="north" preview={null} onSelectDistrict={select} />);
  const center = screen.getByRole("button", { name: "Центральный район" }); center.focus();
  await user.keyboard("{Enter}"); expect(select).toHaveBeenLastCalledWith("center");
  const south = screen.getByRole("button", { name: "Южный район" }); south.focus();
  await user.keyboard(" "); expect(select).toHaveBeenLastCalledWith("south");
  expect(screen.getByRole("button", { name: "Северный район" })).toHaveAttribute("aria-pressed", "true");
});
it("does not disable replacement based on the old remaining budget", async () => {
  const select = vi.fn(); const user = userEvent.setup();
  render(<InitiativePicker initiatives={data.initiatives} direction="transport" districtId="north" selectedInitiativeId="transport-premium" remainingBudget={0} onSelect={select} onRemove={vi.fn()} />);
  const replace = screen.getByRole("button", { name: /Заменить:.*базовый/ });
  expect(replace).toBeEnabled(); await user.click(replace); expect(select).toHaveBeenCalledWith("transport-basic");
});
it("builds, replaces, relocates and removes a draft without pretending the scaffold can calculate", async () => {
  const user = userEvent.setup(); render(<GameShell data={data} />);
  expect(screen.getByRole("button", { name: /Завершить сценарий/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: /Выбрать:.*базовый/ }));
  const plan = screen.getByRole("region", { name: "Ваши решения" });
  expect(within(plan).getAllByRole("listitem")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: /Заменить:.*расширенный/ }));
  expect(within(plan).getAllByRole("listitem")).toHaveLength(1);
  expect(within(plan).getByText(/расширенный масштаб · Северный/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Южный район" }));
  await user.click(screen.getByRole("button", { name: /Выбрать:.*базовый/ }));
  expect(within(plan).getByText(/базовый масштаб · Южный/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Удалить: Транспорт" }));
  expect(within(plan).queryAllByRole("listitem")).toHaveLength(0);
  expect(screen.getByText(/Бюджет и последствия пока не проверяются/)).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Выбрать:.*базовый/ }));
  await user.click(screen.getByRole("button", { name: "Начать заново" }));
  expect(within(plan).queryAllByRole("listitem")).toHaveLength(0);
});
