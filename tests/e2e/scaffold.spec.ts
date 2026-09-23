import { expect, test } from "@playwright/test";

test("production page renders the scaffold without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Аким на 5 часов", level: 1 })).toBeVisible();
  await expect(page.getByText("100 условных единиц")).toBeVisible();
  await expect(page.getByText(/Полное прохождение пока недоступно/)).toBeVisible();
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
