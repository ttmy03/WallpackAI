import { expect, test } from "@playwright/test";

test("landing page links to guided pack wizard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /etsy-ready/i })).toBeVisible();
  await page.getByRole("link", { name: /start creating/i }).first().click();

  await expect(
    page.getByRole("heading", { name: /create an etsy-ready wall-art pack/i })
  ).toBeVisible();
  await expect(page.getByLabel(/subject or theme/i)).toBeVisible();
});
