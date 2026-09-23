import { expect, test } from "@playwright/test";

test("production game draft supports keyboard selection, replacement and mobile layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Аким на 5 часов", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Состояние сценария" })).toContainText("100 условных единиц");
  await expect(page.getByText(/полное прохождение недоступно/)).toBeVisible();
  const center = page.getByRole("button", { name: "Центральный район" });
  await center.focus(); await page.keyboard.press("Enter");
  await expect(center).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Выбрать:.*базовый/ }).click();
  const plan = page.getByRole("region", { name: "Ваши решения" });
  await expect(plan.getByRole("listitem")).toHaveCount(1);
  await expect(plan).toContainText("Центральный");
  await page.getByRole("button", { name: /Заменить:.*расширенный/ }).click();
  await expect(plan.getByRole("listitem")).toHaveCount(1);
  await expect(plan).toContainText("расширенный масштаб");
  await page.getByRole("button", { name: "Удалить: Транспорт" }).click();
  await expect(plan.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Завершить сценарий/ })).toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("both API placeholders explicitly return 501", async ({ request }) => {
  for (const endpoint of ["/api/simulate", "/api/analysis"]) {
    const response = await request.post(endpoint, { data: {} });
    expect(response.status()).toBe(501);
    expect(await response.json()).toMatchObject({ ok: false, error: { code: "NOT_IMPLEMENTED" } });
  }
});
