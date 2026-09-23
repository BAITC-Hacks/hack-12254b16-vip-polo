import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://127.0.0.1:3001";
const fixtures = Object.fromEntries(await Promise.all(["A", "B", "C", "D", "E"].map(async key =>
  [key, JSON.parse(await readFile(new URL(`../fixtures/scenario-${key}.json`, import.meta.url), "utf8"))])));
async function post(body, expectedStatus, expected, label) {
  const response = await fetch(new URL("/api/simulate", base), {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });
  assert.equal(response.status, expectedStatus, label);
  const actual = await response.json();
  if (typeof expected === "string") {
    assert.equal(actual.ok, false, label);
    assert.equal(actual.error.code, expected, label);
    assert.equal(Object.hasOwn(actual, "data"), false, label);
  } else assert.deepEqual(actual, expected, label);
  console.log(`${label}: HTTP ${response.status}${actual.ok ? `, spent=${actual.data.budget.spent}, Score=${actual.data.score.after}` : `, ${actual.error.code}`}`);
}
for (const key of ["A", "B", "C", "D"]) {
  await post(JSON.stringify(fixtures[key].request), key === "D" ? 422 : 200, fixtures[key].expected, key);
}
await post(JSON.stringify(fixtures.E.request), 422, fixtures.E.finalExpected, "E final");
await post("{", 400, "INVALID_REQUEST", "Malformed JSON");
for (const field of ["cost", "budget", "score", "Score", "facts", "mode"]) {
  await post(JSON.stringify({ ...fixtures.D.request, [field]: 0 }), 400, "INVALID_REQUEST", `Forged ${field}`);
}
await post(JSON.stringify({ ...fixtures.A.request, decisions: fixtures.A.request.decisions.map(d => ({ ...d, cost: 0 })) }), 400, "INVALID_REQUEST", "Forged decision cost");
await post(JSON.stringify({ ...fixtures.A.request, modelVersion: "old" }), 409, "VERSION_MISMATCH", "Stale version");
await post(JSON.stringify({ ...fixtures.A.request, decisions: [{ ...fixtures.A.request.decisions[0], districtId: "unknown" }] }), 422, "UNKNOWN_DISTRICT", "Unknown district");
const json = JSON.stringify(fixtures.A.request);
await post(json + " ".repeat(16384 - Buffer.byteLength(json)), 200, fixtures.A.expected, "Exactly 16 KiB");
await post(json + " ".repeat(16385 - Buffer.byteLength(json)), 413, "PAYLOAD_TOO_LARGE", "Over 16 KiB");
console.log("All 17 live HTTP checks passed.");
