import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { POST } from "@/app/api/analysis/route";
import { analyzeScenario } from "@/lib/ai";
import { analysisOutcomeSchema } from "@/shared/schema";
import type { AnalysisResponse, ErrorCode, Outcome } from "@/shared/types";
import { scenarios } from "../fixtures";

vi.mock("@/lib/ai", () => ({ analyzeScenario: vi.fn() }));

const analyze = vi.mocked(analyzeScenario);
const endpoint = "http://localhost/api/analysis";
const encoder = new TextEncoder();
const MAX_BODY_BYTES = 16 * 1024;
const success = (): Outcome<AnalysisResponse> => {
  if (!scenarios.A.expected.ok) throw new Error("Missing scenario A result");
  const simulation = structuredClone(scenarios.A.expected.data);
  return {
    ok: true,
    data: {
      simulation,
      analysis: {
        scenarioId: simulation.scenarioId,
        modelVersion: simulation.modelVersion,
        datasetVersion: simulation.datasetVersion,
        source: "ai",
        status: "ready",
        summary: { text: "Объяснение проверенного результата.", factIds: ["score:after"] },
        strengths: [], risks: [], tradeoffs: [], recommendations: [],
      },
    },
  };
};

function jsonRequest(body: unknown): Request {
  return new Request(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

function streamRequest(chunks: Uint8Array[], headers?: HeadersInit): Request {
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  });
  // Node requires duplex for a streamed request; browsers never construct this fixture.
  return new Request(endpoint, { method: "POST", body: stream, headers, duplex: "half" } as RequestInit);
}

async function expectError(response: Response, status: number, code: ErrorCode) {
  expect(response.status).toBe(status);
  const body: unknown = await response.json();
  expect(analysisOutcomeSchema.safeParse(body).success).toBe(true);
  expect(body).toMatchObject({ ok: false, error: { code } });
  return body;
}

beforeEach(() => {
  analyze.mockReset();
  analyze.mockResolvedValue(success());
});

describe("POST /api/analysis", () => {
  it("exposes Request for Next's generated types while safely handling a direct empty call", async () => {
    expectTypeOf<Parameters<typeof POST>[0]>().toEqualTypeOf<Request>();
    await expectError(await POST(), 400, "INVALID_REQUEST");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns the shared Outcome and passes only the validated original scenario", async () => {
    const response = await POST(jsonRequest(scenarios.A.request));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const result: unknown = await response.json();
    expect(analysisOutcomeSchema.safeParse(result).success).toBe(true);
    expect(result).toEqual(success());
    expect(analyze).toHaveBeenCalledExactlyOnceWith(scenarios.A.request);
  });

  it.each(["unavailable", "timeout", "invalid_response"] as const)("returns fallback %s with HTTP 200", async status => {
    const outcome = success();
    if (!outcome.ok) throw new Error("Missing result");
    outcome.data.analysis.source = "fallback";
    outcome.data.analysis.status = status;
    analyze.mockResolvedValue(outcome);
    const response = await POST(jsonRequest(scenarios.A.request));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(outcome);
  });

  it.each([
    ["INVALID_REQUEST", 400], ["VERSION_MISMATCH", 409], ["PAYLOAD_TOO_LARGE", 413],
    ["UNKNOWN_DISTRICT", 422], ["UNKNOWN_INITIATIVE", 422], ["DUPLICATE_DIRECTION", 422],
    ["DUPLICATE_INITIATIVE", 422], ["DIRECTION_MISMATCH", 422], ["INCOMPATIBLE_DECISION", 422],
    ["INCOMPLETE_SCENARIO", 422], ["BUDGET_EXCEEDED", 422], ["NOT_IMPLEMENTED", 501],
    ["INTERNAL_ERROR", 500],
  ] satisfies [ErrorCode, number][])("maps %s to HTTP %i and removes internal details", async (code, status) => {
    analyze.mockResolvedValue({
      ok: false,
      error: { code, message: "private-provider-message", field: "private-key", details: { stack: "private-stack" } },
    });
    const body = await expectError(await POST(jsonRequest(scenarios.A.request)), status, code);
    expect(JSON.stringify(body)).not.toContain("private-");
  });

  it.each(["{", "null", "[]", "{}", "", "  "])("rejects malformed JSON or shape: %j", async body => {
    const response = await POST(new Request(endpoint, { method: "POST", body }));
    await expectError(response, 400, "INVALID_REQUEST");
    expect(analyze).not.toHaveBeenCalled();
  });

  it.each(["score", "budget", "facts", "cost"])("rejects client-controlled %s before analysis", async key => {
    await expectError(await POST(jsonRequest({ ...scenarios.A.request, [key]: 100 })), 400, "INVALID_REQUEST");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects extra decision fields and missing request without calling analysis", async () => {
    const body = structuredClone(scenarios.A.request);
    Object.assign(body.decisions[0], { cost: 0 });
    await expectError(await POST(jsonRequest(body)), 400, "INVALID_REQUEST");
    await expectError(await POST(), 400, "INVALID_REQUEST");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("accepts exactly 16 KiB of actual JSON bytes", async () => {
    const body = JSON.stringify(scenarios.A.request);
    const padded = body + " ".repeat(MAX_BODY_BYTES - encoder.encode(body).byteLength);
    const response = await POST(streamRequest([encoder.encode(padded)]));
    expect(response.status).toBe(200);
    expect(analyze).toHaveBeenCalledExactlyOnceWith(scenarios.A.request);
  });

  it.each([undefined, { "content-length": "1" }])("rejects actual streamed bytes over 16 KiB despite headers %j", async headers => {
    const body = JSON.stringify(scenarios.A.request);
    const padded = body + " ".repeat(MAX_BODY_BYTES + 1 - encoder.encode(body).byteLength);
    const bytes = encoder.encode(padded);
    await expectError(await POST(streamRequest([bytes.slice(0, 300), bytes.slice(300)], headers)), 413, "PAYLOAD_TOO_LARGE");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("counts UTF-8 bytes rather than string characters", async () => {
    const body = JSON.stringify({ ...scenarios.A.request, modelVersion: "я".repeat(8200) });
    expect(body.length).toBeLessThan(MAX_BODY_BYTES);
    expect(encoder.encode(body).byteLength).toBeGreaterThan(MAX_BODY_BYTES);
    await expectError(await POST(streamRequest([encoder.encode(body)])), 413, "PAYLOAD_TOO_LARGE");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("decodes UTF-8 characters split between chunks", async () => {
    const input = { ...scenarios.A.request, modelVersion: "модель" };
    const bytes = encoder.encode(JSON.stringify(input));
    const split = bytes.indexOf(0xd0) + 1;
    expect((await POST(streamRequest([bytes.slice(0, split), bytes.slice(split)]))).status).toBe(200);
    expect(analyze).toHaveBeenCalledExactlyOnceWith(input);
  });

  it("rejects invalid UTF-8 and upload errors safely", async () => {
    await expectError(await POST(streamRequest([new Uint8Array([0xc3, 0x28])])), 400, "INVALID_REQUEST");
    const stream = new ReadableStream({ start(controller) { controller.error(new Error("private-upload-stack")); } });
    const request = new Request(endpoint, { method: "POST", body: stream, duplex: "half" } as RequestInit);
    const body = await expectError(await POST(request), 400, "INVALID_REQUEST");
    expect(JSON.stringify(body)).not.toContain("private-upload-stack");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects a declared excessive length before analysis", async () => {
    const request = new Request(endpoint, {
      method: "POST", body: "{}", headers: { "content-length": String(MAX_BODY_BYTES + 1) },
    });
    await expectError(await POST(request), 413, "PAYLOAD_TOO_LARGE");
    expect(analyze).not.toHaveBeenCalled();
  });

  it("cancels an oversized stream without waiting for upload completion", async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}));
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)); }, cancel,
    });
    const request = new Request(endpoint, { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expectError(await POST(request), 413, "PAYLOAD_TOO_LARGE");
    expect(cancel).toHaveBeenCalledOnce();
    expect(analyze).not.toHaveBeenCalled();
  });

  it("masks unexpected exceptions and invalid internal responses", async () => {
    analyze.mockRejectedValueOnce(new Error("secret-api-key and stack trace"));
    const body = await expectError(await POST(jsonRequest(scenarios.A.request)), 500, "INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toContain("secret-api-key");
    analyze.mockResolvedValueOnce({ ok: true, data: { secret: "secret-api-key" } } as unknown as Outcome<AnalysisResponse>);
    await expectError(await POST(jsonRequest(scenarios.A.request)), 500, "INTERNAL_ERROR");
  });
});
