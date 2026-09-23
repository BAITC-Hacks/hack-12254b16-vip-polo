"use client";
import type { ResultsPanelProps } from "@/shared/ports";

export function ResultsPanel({ result }: ResultsPanelProps) {
  return <section aria-label="Результаты"><p>Экран результатов ещё не реализован.</p><p>Версия модели: {result.modelVersion}</p></section>;
}
