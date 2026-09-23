// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CityMap } from "@/features/game/CityMap";
import { getGameData } from "@/lib/simulation";
import type { SimulationResult } from "@/shared/types";
import { scenarios } from "../fixtures";

afterEach(cleanup);

function fixturePreview(): SimulationResult {
  if (!scenarios.A.expected.ok) throw new Error("Fixture A must succeed");
  return structuredClone(scenarios.A.expected.data);
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

it("preserves provided district IDs for mouse and keyboard selection after reordering", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const districts = getGameData().districts.map(district => ({ ...district, id: `test-${district.id}` })).reverse();
  render(<CityMap districts={districts} selectedDistrictId="test-center" preview={null} onSelectDistrict={onSelect} />);

  await user.click(screen.getByRole("button", { name: "Южный район" }));
  const north = screen.getByRole("button", { name: "Северный район" });
  north.focus();
  await user.keyboard("{Enter}");
  const center = screen.getByRole("button", { name: "Центральный район" });
  center.focus();
  await user.keyboard(" ");

  expect(onSelect.mock.calls).toEqual([["test-south"], ["test-north"], ["test-center"]]);
  expect(center).toHaveAttribute("aria-pressed", "true");
  expect(north).toHaveAttribute("aria-pressed", "false");
});

it("shows the selected district baseline and matches reordered preview rows by ID", () => {
  const districts = getGameData().districts.reverse();
  const props = { districts, selectedDistrictId: "north", onSelectDistrict: vi.fn() };
  const { rerender } = render(<CityMap {...props} preview={null} />);
  expect(screen.getByRole("meter", { name: "Транспорт: Северный" })).toHaveAttribute("value", "40");
  expect(screen.getByRole("meter", { name: "Озеленение: Северный" })).toHaveAttribute("value", "65");

  const preview = fixturePreview();
  preview.districts.reverse();
  rerender(<CityMap {...props} preview={preview} />);
  expect(screen.getByRole("meter", { name: "Транспорт: Северный" })).toHaveAttribute("value", "45");
  expect(screen.getByRole("meter", { name: "Озеленение: Северный" })).toHaveAttribute("value", "70");
  expect(screen.getByText("40 → 45")).toBeVisible();
  expect(screen.getByText("65 → 70")).toBeVisible();

  rerender(<CityMap {...props} selectedDistrictId="center" preview={preview} />);
  expect(screen.getByRole("meter", { name: "Транспорт: Центральный" })).toHaveAttribute("value", "65");
  expect(screen.queryByRole("meter", { name: "Транспорт: Северный" })).not.toBeInTheDocument();
});

it.each([null, "missing-district"])("keeps every district selectable without metrics for selection %s", async selectedDistrictId => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<CityMap districts={getGameData().districts} selectedDistrictId={selectedDistrictId} preview={fixturePreview()} onSelectDistrict={onSelect} />);
  expect(screen.queryAllByRole("meter")).toHaveLength(0);
  for (const button of screen.getAllByRole("button")) expect(button).toHaveAttribute("aria-pressed", "false");
  await user.click(screen.getByRole("button", { name: "Центральный район" }));
  expect(onSelect).toHaveBeenCalledWith("center");
});

it("does not mutate districts or preview while selecting and rerendering", async () => {
  const user = userEvent.setup();
  const districts = freezeTree(getGameData().districts);
  const preview = freezeTree(fixturePreview());
  const originalDistricts = structuredClone(districts);
  const originalPreview = structuredClone(preview);
  const onSelect = vi.fn();
  const { rerender } = render(<CityMap districts={districts} selectedDistrictId="north" preview={preview} onSelectDistrict={onSelect} />);
  await user.click(screen.getByRole("button", { name: "Южный район" }));
  rerender(<CityMap districts={districts} selectedDistrictId="south" preview={preview} onSelectDistrict={onSelect} />);
  expect(onSelect).toHaveBeenCalledWith("south");
  expect(districts).toEqual(originalDistricts);
  expect(preview).toEqual(originalPreview);
});
