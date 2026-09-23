import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/simulate/route";
import * as simulation from "@/lib/simulation";
import { simulationOutcomeSchema } from "@/shared/schema";
import { scenarios } from "../fixtures";

const url = "http://localhost/api/simulate";
const request = (body: unknown) => new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const body = await response.json();
  expect(body).toMatchObject({ ok: false, error: { code } });
  expect(body).not.toHaveProperty("data");
  expect(simulationOutcomeSchema.safeParse(body).success).toBe(true);
}
afterEach(() => vi.restoreAllMocks());

describe("POST /api/simulate direct requests", () => {
  for (const key of ["A", "B", "C"] as const) it(`returns full final fixture ${key} from server data`, async () => {
    const response = await POST(request(scenarios[key].request));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(scenarios[key].expected);
  });
  it("rejects D with HTTP 422 and no result", async () => {
    const response = await POST(request(scenarios.D.request));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(scenarios.D.expected);
  });
  it("rejects E and an empty draft because the server always uses final mode", async () => {
    await expectError(await POST(request(scenarios.E.request)), 422, "INCOMPLETE_SCENARIO");
    await expectError(await POST(request({ ...scenarios.A.request, decisions: [] })), 422, "INCOMPLETE_SCENARIO");
  });
  it("returns the same scenario identity and full result for reordered decisions", async () => {
    const reordered = { ...scenarios.A.request, decisions: [...scenarios.A.request.decisions].reverse() };
    expect(await (await POST(request(reordered))).json()).toEqual(scenarios.A.expected);
  });
  for (const field of ["cost", "budget", "score", "Score", "facts", "data", "mode"]) {
    it(`rejects client-supplied ${field}`, async () => {
      await expectError(await POST(request({ ...scenarios.D.request, [field]: 0 })), 400, "INVALID_REQUEST");
    });
  }
  for (const field of ["cost", "budget", "score", "effects"]) {
    it(`rejects client-supplied decision ${field}`, async () => {
      const body = { ...scenarios.D.request, decisions: scenarios.D.request.decisions.map(d => ({ ...d, [field]: 0 })) };
      await expectError(await POST(request(body)), 400, "INVALID_REQUEST");
    });
  }
  for (const version of ["modelVersion", "datasetVersion"]) {
    it(`returns HTTP 409 for stale ${version}`, async () => {
      await expectError(await POST(request({ ...scenarios.A.request, [version]: "old" })), 409, "VERSION_MISMATCH");
    });
  }
  it("returns HTTP 422 for unknown IDs, duplicates and mismatched direction", async () => {
    for (const [patch, code] of [
      [{ districtId: "unknown" }, "UNKNOWN_DISTRICT"],
      [{ initiativeId: "unknown" }, "UNKNOWN_INITIATIVE"],
      [{ direction: "safety" }, "DIRECTION_MISMATCH"],
    ] as const) {
      const body = structuredClone(scenarios.A.request);
      Object.assign(body.decisions[0], patch);
      await expectError(await POST(request(body)), 422, code);
    }
    const duplicate = structuredClone(scenarios.A.request);
    duplicate.decisions[1] = duplicate.decisions[0];
    await expectError(await POST(request(duplicate)), 422, "DUPLICATE_INITIATIVE");
  });
  for (const body of ["", "{", "undefined", "{\"decisions\":", "null", "[]", "{}"]) {
    it(`returns HTTP 400 for bad JSON or shape: ${body}`, async () => {
      await expectError(await POST(new Request(url, { method: "POST", body })), 400, "INVALID_REQUEST");
    });
  }
  it("rejects a missing body", async () => {
    await expectError(await POST(new Request(url, { method: "POST" })), 400, "INVALID_REQUEST");
    await expectError(await POST(), 400, "INVALID_REQUEST");
  });
  it("enforces declared body size before reading", async () => {
    const read = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ pull: read }, { highWaterMark: 0 });
    const req = new Request(url, { method: "POST", body: stream, duplex: "half", headers: { "Content-Length": "16385" } } as RequestInit);
    await expectError(await POST(req), 413, "PAYLOAD_TOO_LARGE");
    expect(read).not.toHaveBeenCalled();
  });
  it("accepts exactly 16 KiB and rejects the next byte even with a false small header", async () => {
    const json = JSON.stringify(scenarios.A.request);
    const padding = " ".repeat(16384 - new TextEncoder().encode(json).length);
    expect((await POST(new Request(url, { method: "POST", body: json + padding }))).status).toBe(200);
    await expectError(await POST(new Request(url, { method: "POST", body: json + padding + " ", headers: { "Content-Length": "1" } })), 413, "PAYLOAD_TOO_LARGE");
  });
  it("counts UTF-8 bytes, not characters", async () => {
    const text = JSON.stringify({ ...scenarios.A.request, unexpected: "я".repeat(8500) });
    expect(text.length).toBeLessThan(16384);
    await expectError(await POST(new Request(url, { method: "POST", body: text })), 413, "PAYLOAD_TOO_LARGE");
  });
  it("cancels an oversized streamed request without reading the remaining chunks", async () => {
    let pulls = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(8193).fill(32)); }, cancel,
    }, { highWaterMark: 0 });
    const req = new Request(url, { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expectError(await POST(req), 413, "PAYLOAD_TOO_LARGE");
    expect(cancel).toHaveBeenCalledOnce();
    expect(pulls).toBe(2);
  });
  it("handles multi-byte UTF-8 split across chunks and malformed UTF-8", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...scenarios.A.request, modelVersion: "версия" }));
    let position = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (position === bytes.length) controller.close();
        else controller.enqueue(bytes.slice(position, ++position));
      },
    });
    await expectError(await POST(new Request(url, { method: "POST", body: stream, duplex: "half" } as RequestInit)), 409, "VERSION_MISMATCH");
    await expectError(await POST(new Request(url, { method: "POST", body: new Uint8Array([0xff]) })), 400, "INVALID_REQUEST");
  });
  it("does not expose stream errors", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("PRIVATE_STREAM_DETAIL")); } });
    const response = await POST(new Request(url, { method: "POST", body: stream, duplex: "half" } as RequestInit));
    const text = await response.text();
    expect(response.status).toBe(400);
    expect(text).not.toContain("PRIVATE_STREAM_DETAIL");
  });
  it("does not expose unexpected internal errors or stack traces", async () => {
    vi.spyOn(simulation, "getGameData").mockImplementation(() => { throw new Error("PRIVATE_INTERNAL_DETAIL"); });
    const response = await POST(request(scenarios.A.request));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ ok: false, error: { code: "INTERNAL_ERROR", message: "Не удалось выполнить расчёт." } });
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE_INTERNAL_DETAIL|stack/);
  });
});
