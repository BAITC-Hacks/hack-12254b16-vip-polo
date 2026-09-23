import { analyzeScenario } from "@/lib/ai";
import { analysisOutcomeSchema, scenarioRequestSchema } from "@/shared/schema";
import type { AnalysisResponse, AppError, ErrorCode, Outcome } from "@/shared/types";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const messages: Record<ErrorCode, string> = {
  INVALID_REQUEST: "Ожидается корректный JSON-запрос сценария.",
  UNKNOWN_DISTRICT: "В сценарии указан неизвестный район.",
  UNKNOWN_INITIATIVE: "В сценарии указано неизвестное мероприятие.",
  DUPLICATE_DIRECTION: "Для направления выбрано несколько мероприятий.",
  DUPLICATE_INITIATIVE: "Мероприятие повторяется в сценарии.",
  DIRECTION_MISMATCH: "Мероприятие не соответствует направлению.",
  INCOMPATIBLE_DECISION: "Мероприятие недоступно в выбранном районе.",
  INCOMPLETE_SCENARIO: "Выберите по одному мероприятию в каждом направлении.",
  BUDGET_EXCEEDED: "Стоимость сценария превышает бюджет.",
  VERSION_MISMATCH: "Версия сценария устарела. Обновите страницу.",
  PAYLOAD_TOO_LARGE: "Тело запроса превышает 16 KiB.",
  NOT_IMPLEMENTED: "Расчётный модуль пока недоступен.",
  INTERNAL_ERROR: "Не удалось выполнить анализ сценария.",
};

function failure(code: ErrorCode): { ok: false; error: AppError } {
  return { ok: false, error: { code, message: messages[code] } };
}

function respond(outcome: Outcome<AnalysisResponse>): Response {
  const status = outcome.ok ? 200
    : outcome.error.code === "INVALID_REQUEST" ? 400
    : outcome.error.code === "VERSION_MISMATCH" ? 409
    : outcome.error.code === "PAYLOAD_TOO_LARGE" ? 413
    : outcome.error.code === "NOT_IMPLEMENTED" ? 501
    : outcome.error.code === "INTERNAL_ERROR" ? 500 : 422;
  // Keep exception, provider and request details away from the public boundary.
  return Response.json(outcome.ok ? outcome : failure(outcome.error.code), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readBody(request: Request): Promise<Outcome<unknown>> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > MAX_BODY_BYTES) {
    return failure("PAYLOAD_TOO_LARGE");
  }
  if (!request.body) return failure("INVALID_REQUEST");

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
        // Do not wait for an untrusted upload's cancellation to settle.
        void reader.cancel().catch(() => undefined);
        return failure("PAYLOAD_TOO_LARGE");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return { ok: true, data: JSON.parse(body) as unknown };
  } catch {
    void reader.cancel().catch(() => undefined);
    return failure("INVALID_REQUEST");
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request?: Request): Promise<Response> {
  try {
    if (!request) return respond(failure("INVALID_REQUEST"));
    const body = await readBody(request);
    if (!body.ok) return respond(body);
    const input = scenarioRequestSchema.safeParse(body.data);
    if (!input.success) return respond(failure("INVALID_REQUEST"));
    const outcome = analysisOutcomeSchema.safeParse(await analyzeScenario(input.data));
    if (!outcome.success) return respond(failure("INTERNAL_ERROR"));
    return respond(outcome.data);
  } catch {
    return respond(failure("INTERNAL_ERROR"));
  }
}
