import config from "@/data/config.json";
import districts from "@/data/districts.json";
import initiatives from "@/data/initiatives.json";
import { gameDataSchema } from "@/shared/schema";
import { notImplemented } from "@/shared/not-implemented";
import type { SimulationPort } from "@/shared/ports";

const gameData = gameDataSchema.parse({ config, districts, initiatives });

export const getGameData: SimulationPort["getGameData"] = () => structuredClone(gameData);
export const validateScenario: SimulationPort["validateScenario"] = () => notImplemented("Проверка сценария");
export const simulateScenario: SimulationPort["simulateScenario"] = () => notImplemented("Расчёт сценария");
