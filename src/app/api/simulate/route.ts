import { getGameData, simulateScenario } from "@/lib/simulation";
import { scenarioRequestSchema } from "@/shared/schema";
import type { AppError, Outcome, SimulationResult } from "@/shared/types";

const MAX_BODY_BYTES = 16 * 1024;
const invalidRequest: AppError = { code: "INVALID_REQUEST", message: "Ожидается корректный JSON-запрос сценария." };
const tooLarge: AppError = { code: "PAYLOAD_TOO_LARGE", message: "Тело запроса превышает 16 KiB." };

function respond(outcome: Outcome<SimulationResult>): Response {
  const status = outcome.ok ? 200 : outcome.error.code === "INVALID_REQUEST" ? 400
    : outcome.error.code === "VERSION_MISMATCH" ? 409
    : outcome.error.code === "PAYLOAD_TOO_LARGE" ? 413
    : outcome.error.code === "INTERNAL_ERROR" ? 500 : 422;
  return Response.json(outcome, { status });
}

async function readBody(request: Request): Promise<Outcome<unknown>> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) return { ok: false, error: tooLarge };
  if (!request.body) return { ok: false, error: invalidRequest };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, error: tooLarge };
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return { ok: true, data: JSON.parse(body) as unknown };
  } catch {
    return { ok: false, error: invalidRequest };
  } finally {
    reader.releaseLock();
  }
}

// Keep the scaffold's direct no-argument call while exposing Next's required Request type.
export function POST(): Promise<Response>;
export function POST(request: Request): Promise<Response>;
export async function POST(request?: Request): Promise<Response> {
  try {
    if (!request) return respond({ ok: false, error: invalidRequest });
    const body = await readBody(request);
    if (!body.ok) return respond(body);
    const parsed = scenarioRequestSchema.safeParse(body.data);
    if (!parsed.success) return respond({ ok: false, error: invalidRequest });
    return respond(simulateScenario(parsed.data, getGameData(), "final"));
  } catch {
    return respond({ ok: false, error: { code: "INTERNAL_ERROR", message: "Не удалось выполнить расчёт." } });
  }
}
