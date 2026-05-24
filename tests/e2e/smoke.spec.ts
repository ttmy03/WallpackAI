import { expect, test } from "@playwright/test";

test("landing page links into the authenticated app flow", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /etsy-ready/i })
  ).toBeVisible();
  await page
    .getByRole("link", { name: /start creating/i })
    .first()
    .click();

  await expect(
    page.getByRole("heading", { name: /sign in required/i })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^sign in$/i }).last()
  ).toBeVisible();
});
