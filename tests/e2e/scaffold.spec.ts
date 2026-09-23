import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { initiativeSchema, scenarioRequestSchema, simulationOutcomeSchema } from "../../src/shared/schema";

// Read JSON explicitly because the Playwright runner loads this file as Node ESM.
const initiatives = initiativeSchema.array().parse(JSON.parse(readFileSync(
  new URL("../../src/data/initiatives.json", import.meta.url), "utf8",
)));
function readFixture(name: "A" | "B" | "C" | "D" | "E") {
  const raw: { request: unknown; expected: unknown } = JSON.parse(readFileSync(
    new URL(`../fixtures/scenario-${name}.json`, import.meta.url), "utf8",
  ));
  return { request: scenarioRequestSchema.parse(raw.request), expected: simulationOutcomeSchema.parse(raw.expected) };
}
const scenarios = { A: readFixture("A"), B: readFixture("B"), C: readFixture("C"), D: readFixture("D"), E: readFixture("E") };

const directions = [
  ["transport", "Транспорт"], ["greenery", "Озеленение"], ["social", "Социальная среда"],
  ["safety", "Безопасность"], ["service", "Городской сервис"],
] as const;

function initiativeTitle(id: string) {
  const initiative = initiatives.find(item => item.id === id);
  if (!initiative) throw new Error(`Missing initiative ${id}`);
  return initiative.title;
}

async function choose(page: Page, id: string, action: "Выбрать" | "Заменить" = "Выбрать") {
  await page.getByRole("button", { name: `${action}: ${initiativeTitle(id)}`, exact: true }).click();
}

async function fillPlan(page: Page, level: "basic" | "standard") {
  for (const [direction, label] of directions) {
    await page.getByRole("group", { name: "Направления", exact: true }).getByRole("button", { name: label }).click();
    await choose(page, `${direction}-${level}`);
  }
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("map keyboard and mouse selection preserve transfer, replacement, cancellation and mobile layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Аким на 5 часов", level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByText(/полное прохождение недоступно/)).toHaveCount(0);
  const plan = page.getByRole("region", { name: "Ваши решения", exact: true });
  const finish = page.getByRole("button", { name: "Завершить сценарий" });
  await expect(finish).toBeDisabled();

  const center = page.getByRole("button", { name: "Центральный район", exact: true });
  await center.focus();
  await page.keyboard.press("Enter");
  await expect(center).toHaveAttribute("aria-pressed", "true");
  await choose(page, "transport-basic");
  await expect(plan.getByRole("listitem")).toHaveCount(1);
  await expect(plan).toContainText("Центральный");

  const north = page.getByRole("button", { name: "Северный район", exact: true });
  await north.focus();
  await page.keyboard.press("Space");
  await expect(north).toHaveAttribute("aria-pressed", "true");
  await expect(center).toHaveAttribute("aria-pressed", "false");
  await choose(page, "transport-basic", "Заменить");
  await expect(plan.getByRole("listitem")).toHaveCount(1);
  await expect(plan).toContainText("Северный");
  await expect(plan).not.toContainText("Центральный");

  await choose(page, "transport-premium", "Заменить");
  await expect(plan).toContainText(initiativeTitle("transport-premium"));
  await expect(page.getByText("Использовано 30 из 100", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Южный район", exact: true }).click();
  await expect(page.getByRole("button", { name: "Южный район", exact: true })).toHaveAttribute("aria-pressed", "true");
  await choose(page, "transport-basic", "Заменить");
  await expect(plan).toContainText("Южный");
  await expect(plan.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Отменить решение", exact: true }).click();
  await expect(plan.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText("Использовано 0 из 100", { exact: true })).toBeVisible();
  await expect(finish).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(north).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("zero remaining budget permits a cheaper replacement and blocks an unaffordable one", async ({ page }) => {
  await page.goto("/");
  await fillPlan(page, "standard");
  await expect(page.getByText("Использовано 100 из 100", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Завершить сценарий" })).toBeEnabled();
  await page.getByRole("button", { name: "Изменить: Транспорт", exact: true }).click();
  const premium = page.getByRole("button", { name: `Заменить: ${initiativeTitle("transport-premium")}`, exact: true });
  await expect(premium).toBeDisabled();
  await choose(page, "transport-basic", "Заменить");
  await expect(page.getByText("Использовано 90 из 100", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ваши решения", exact: true }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Завершить сценарий" })).toBeEnabled();
});

test("real A scenario completes, retries fallback, exports JSON, edits and resets on mobile", async ({ page }) => {
  const errors: string[] = [];
  const calls: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && ["/api/simulate", "/api/analysis"].includes(path)) calls.push(path);
  });
  await page.goto("/");
  await fillPlan(page, "basic");
  const responsePromise = page.waitForResponse(response => response.url().endsWith("/api/simulate") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Завершить сценарий" }).click();
  const calculation = await responsePromise;
  expect(calculation.status()).toBe(200);
  expect(await calculation.json()).toEqual(scenarios.A.expected);
  const results = page.getByRole("region", { name: "Итог сценария", exact: true });
  await expect(results.getByRole("heading", { name: "Результаты сценария", exact: true })).toBeVisible();
  await expect(results.getByText("Fallback · без AI", { exact: true })).toBeVisible();
  await expect(results.getByText(/Это не ответ AI/)).toBeVisible();
  await expect(results.getByRole("region", { name: "Astana Quality of Life Score", exact: true })).toContainText("51,67");
  expect(calls).toEqual(["/api/simulate", "/api/analysis"]);

  const retryResponse = page.waitForResponse(response => response.url().endsWith("/api/analysis") && response.request().method() === "POST");
  await results.getByRole("button", { name: "Повторить AI-анализ", exact: true }).click();
  expect((await retryResponse).status()).toBe(200);
  await expect(results.getByText("Fallback · без AI", { exact: true })).toBeVisible();
  expect(calls).toEqual(["/api/simulate", "/api/analysis", "/api/analysis"]);

  const downloadPromise = page.waitForEvent("download");
  await results.getByRole("button", { name: "Скачать JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("akim-results.json");
  const stream = await download.createReadStream();
  if (!stream) throw new Error("No JSON download stream");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!scenarios.A.expected.ok) throw new Error("A must be a valid fixture");
  expect(exported.simulation).toEqual(scenarios.A.expected.data);
  expect(exported).toMatchObject({ exportVersion: 1, synthetic: true, analysis: { source: "fallback", status: "unavailable" } });
  expect(exported.analysis.scenarioId).toBe(exported.simulation.scenarioId);

  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await results.getByRole("button", { name: "Редактировать решения", exact: true }).click();
  await expect(results).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ваши решения", exact: true }).getByRole("listitem")).toHaveCount(5);
  await page.getByRole("button", { name: "Завершить сценарий" }).click();
  await expect(results.getByText("Fallback · без AI", { exact: true })).toBeVisible();
  await results.getByRole("button", { name: "Новая игра", exact: true }).click();
  await expect(results).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ваши решения", exact: true }).getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText("Использовано 0 из 100", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Завершить сценарий" })).toBeDisabled();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

for (const endpoint of ["/api/simulate", "/api/analysis"]) {
  test(`${endpoint} returns actual complete A/B/C results without a provider key`, async ({ request }) => {
    for (const name of ["A", "B", "C"] as const) {
      const fixture = scenarios[name];
      const response = await request.post(endpoint, { data: fixture.request });
      expect(response.status(), `${endpoint} ${name}`).toBe(200);
      const body = await response.json();
      if (endpoint === "/api/simulate") expect(body).toEqual(fixture.expected);
      else {
        if (!fixture.expected.ok) throw new Error("Expected a successful fixture");
        expect(body).toMatchObject({ ok: true, data: { analysis: { source: "fallback", status: "unavailable" } } });
        expect(body.data.simulation).toEqual(fixture.expected.data);
        expect(body.data.analysis.scenarioId).toBe(fixture.expected.data.scenarioId);
      }
    }
  });

  test(`${endpoint} rejects invalid final requests and oversized UTF-8 bodies`, async ({ request }) => {
    const unknown = structuredClone(scenarios.A.request);
    unknown.decisions[0].districtId = "unknown-district";
    const unknownInitiative = structuredClone(scenarios.A.request);
    unknownInitiative.decisions[0].initiativeId = "unknown-initiative";
    const duplicateInitiative = structuredClone(scenarios.A.request);
    duplicateInitiative.decisions[1] = { ...duplicateInitiative.decisions[0] };
    const duplicateDirection = structuredClone(scenarios.A.request);
    duplicateDirection.decisions[1] = { ...duplicateDirection.decisions[0], initiativeId: "transport-standard" };
    const mismatchedDirection = structuredClone(scenarios.A.request);
    mismatchedDirection.decisions[0].direction = "safety";
    const forgedDecisionCost = {
      ...scenarios.A.request,
      decisions: scenarios.A.request.decisions.map((decision, index) => index === 0 ? { ...decision, cost: 0 } : decision),
    };
    const cases = [
      { data: scenarios.D.request, status: 422, code: "BUDGET_EXCEEDED" },
      { data: scenarios.E.request, status: 422, code: "INCOMPLETE_SCENARIO" },
      { data: {}, status: 400, code: "INVALID_REQUEST" },
      ...["cost", "score", "budget", "facts"].map(field => ({
        data: { ...scenarios.A.request, [field]: field === "facts" ? [] : 0 }, status: 400, code: "INVALID_REQUEST",
      })),
      { data: forgedDecisionCost, status: 400, code: "INVALID_REQUEST" },
      { data: unknown, status: 422, code: "UNKNOWN_DISTRICT" },
      { data: unknownInitiative, status: 422, code: "UNKNOWN_INITIATIVE" },
      { data: duplicateInitiative, status: 422, code: "DUPLICATE_INITIATIVE" },
      { data: duplicateDirection, status: 422, code: "DUPLICATE_DIRECTION" },
      { data: mismatchedDirection, status: 422, code: "DIRECTION_MISMATCH" },
      { data: { ...scenarios.A.request, datasetVersion: "obsolete" }, status: 409, code: "VERSION_MISMATCH" },
    ];
    for (const item of cases) {
      const response = await request.post(endpoint, { data: item.data });
      expect(response.status(), `${endpoint}: ${item.code}`).toBe(item.status);
      const body = await response.json();
      expect(body).toMatchObject({ ok: false, error: { code: item.code } });
      expect(body).not.toHaveProperty("data");
    }
    for (const [data, status, code] of [
      ["{", 400, "INVALID_REQUEST"],
      [JSON.stringify({ ...scenarios.A.request, padding: "я".repeat(8500) }), 413, "PAYLOAD_TOO_LARGE"],
    ] as const) {
      const response = await request.post(endpoint, { data, headers: { "Content-Type": "application/json" } });
      expect(response.status()).toBe(status);
      expect(await response.json()).toMatchObject({ ok: false, error: { code } });
    }
  });
}
