import type { Direction } from "@/shared/types";
export const directionLabels: Record<Direction, string> = {
  transport: "Транспорт", greenery: "Озеленение", social: "Социальная среда",
  safety: "Безопасность", service: "Городской сервис"
};
export const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
