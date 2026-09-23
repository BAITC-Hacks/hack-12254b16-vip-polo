import { analyzeScenario } from "@/lib/ai";

export async function POST() {
  return Response.json(await analyzeScenario(undefined), { status: 501 });
}
