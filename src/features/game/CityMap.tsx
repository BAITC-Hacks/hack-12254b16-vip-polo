"use client";
import type { CityMapProps } from "@/shared/ports";

export function CityMap({ districts }: CityMapProps) {
  return <section aria-label="Карта районов"><p>Интерактивная карта ещё не реализована. В каталоге районов: {districts.length}.</p></section>;
}
