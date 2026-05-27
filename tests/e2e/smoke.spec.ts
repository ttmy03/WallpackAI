import { expect, test } from "@playwright/test";

test("landing page links into the authenticated app flow", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: /wallpack ai home/i })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /etsy-ready/i })
  ).toBeVisible();

  await page.goto("/pricing");
  await page.getByRole("link", { name: /wallpack ai home/i }).click();
  await expect(page).toHaveURL("/");

  await page
    .getByRole("link", { name: /start creating/i })
    .first()
    .click();

  await expect(
    page.getByRole("heading", { name: /sign in required/i })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /continue with google/i }).last()
  ).toBeVisible();
});
