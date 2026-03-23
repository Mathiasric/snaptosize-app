import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3456";

test.describe("Integrated empty state — onboarding", () => {
  test("packs: always shows guide with steps", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    // Guide title always visible
    await expect(page.locator("text=Get print-ready files in seconds")).toBeVisible();
    // Steps visible
    await expect(page.locator("text=Upload your artwork")).toBeVisible();
    await expect(page.locator("text=Pick your ratio packs")).toBeVisible();
    await expect(page.locator("text=Download Etsy-ready ZIPs")).toBeVisible();
  });

  test("quick-export: always shows guide with steps", async ({ page }) => {
    await page.goto(`${BASE}/app/quick-export`);
    await expect(page.locator("text=Get print-ready files in seconds")).toBeVisible();
    await expect(page.locator("text=Pick size & orientation")).toBeVisible();
  });

  test("only ONE box in right panel (not two)", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    const boxes = page.locator(".rounded-xl.border.border-border.bg-surface");
    const count = await boxes.count();
    expect(count).toBe(1);
  });
});

test.describe("Screenshots — integrated empty state", () => {
  test("packs desktop — guide", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/packs-v3-guide.png", fullPage: true });
  });

  test("packs mobile — guide", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/app/packs`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/packs-v3-mobile-guide.png", fullPage: true });
  });
});
