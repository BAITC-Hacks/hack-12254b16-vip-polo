// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { GameShell } from "@/features/game";
import { getGameData } from "@/lib/simulation";

it("shows the real scaffold status and the common synthetic starting data", () => {
  render(<GameShell data={getGameData()} />);
  expect(screen.getByRole("heading", { level: 1, name: "Аким на 5 часов" })).toBeVisible();
  expect(screen.getByRole("region", { name: "Состояние сценария" })).toHaveTextContent("100 условных единиц");
  expect(screen.getByText(/полное прохождение недоступно/)).toBeVisible();
  expect(screen.getByText(/Данные синтетические/)).toBeVisible();
});
