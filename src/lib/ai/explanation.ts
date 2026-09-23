import "server-only";
import { z } from "zod";
import type { Fact } from "@/shared/types";

export function explanationSchema(facts: Fact[]) {
  const ids = facts.map(f => f.id);
  if (!ids.length) throw new Error("Нет проверенных фактов.");
  const point = z.strictObject({ text: z.string().trim().min(20).max(600),
    factIds: z.array(z.enum(ids as [string, ...string[]])).min(1).max(6) });
  return z.strictObject({ summary: point, strengths: z.array(point).min(1).max(4),
    risks: z.array(point).min(1).max(4), tradeoffs: z.array(point).min(1).max(4),
    recommendations: z.array(point).max(2) });
}
export type Explanation = z.infer<ReturnType<typeof explanationSchema>>;
export function parseExplanation(value: unknown, facts: Fact[]): Explanation | null {
  const parsed = explanationSchema(facts).safeParse(value);
  if (!parsed.success) return null;
  const points = [parsed.data.summary, ...parsed.data.strengths, ...parsed.data.risks, ...parsed.data.tradeoffs, ...parsed.data.recommendations];
  // Numbers belong to server fact labels, never generated prose or a second Score.
  if (points.some(p => /\p{N}/u.test(p.text) || new Set(p.factIds).size !== p.factIds.length)) return null;
  return parsed.data;
}
