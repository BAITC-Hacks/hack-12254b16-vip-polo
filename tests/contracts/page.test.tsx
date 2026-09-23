// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { GameShell } from "@/features/game";
import { getGameData } from "@/lib/simulation";

it("shows the initial real preview and prevents an incomplete final scenario", () => {
  render(<GameShell data={getGameData()} />);
  expect(screen.getByRole("heading", { level: 1, name: "Аким на 5 часов" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Состояние сценария" })).toHaveTextContent("100 условных единиц");
  expect(screen.queryByText(/Расчёт ещё не подключён/)).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Состояние сценария" })).toHaveTextContent("50");
  expect(screen.getByRole("button", { name: "Завершить сценарий" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Северный район" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(/Данные синтетические/)).toBeVisible();
});
