import { notImplemented } from "@/shared/not-implemented";
import type { SimulationResult } from "@/shared/types";

export async function POST() {
  return Response.json(notImplemented<SimulationResult>("Расчёт сценария"), { status: 501 });
}
