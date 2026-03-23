import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3456";

test.describe("Integrated empty state — onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    await page.evaluate(() => localStorage.removeItem("snaptosize_onboarding_dismissed"));
  });

  test("packs: first visit shows guide in single box", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    // Guide title visible
    await expect(page.locator("text=Get print-ready files in seconds")).toBeVisible();
    // Steps visible
    await expect(page.locator("text=Upload your artwork")).toBeVisible();
    await expect(page.locator("text=Pick your ratio packs")).toBeVisible();
    await expect(page.locator("text=Download Etsy-ready ZIPs")).toBeVisible();
    // The old static title should NOT be visible (replaced by guide)
    await expect(page.locator("text=Your Etsy-ready ZIP packs will appear here.")).not.toBeVisible();
  });

  test("packs: dismiss reveals standard empty state", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    await expect(page.locator("text=Get print-ready files in seconds")).toBeVisible();

    // Dismiss
    await page.locator('button[aria-label="Dismiss"]').first().click();

    // Guide gone, standard info visible
    await expect(page.locator("text=Get print-ready files in seconds")).not.toBeVisible();
    await expect(page.locator("text=Your Etsy-ready ZIP packs will appear here.")).toBeVisible();
    await expect(page.locator("text=300 DPI print-ready")).toBeVisible();
  });

  test("quick-export: first visit shows guide", async ({ page }) => {
    await page.goto(`${BASE}/app/quick-export`);
    await page.evaluate(() => localStorage.removeItem("snaptosize_onboarding_dismissed"));
    await page.goto(`${BASE}/app/quick-export`);

    await expect(page.locator("text=Get print-ready files in seconds")).toBeVisible();
    await expect(page.locator("text=Pick size & orientation")).toBeVisible();
    await expect(page.locator("text=Your export will appear here")).not.toBeVisible();
  });

  test("dismiss persists across pages and refresh", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    await page.locator('button[aria-label="Dismiss"]').first().click();

    // Navigate to quick-export — should show standard empty state
    await page.goto(`${BASE}/app/quick-export`);
    await expect(page.locator("text=Your export will appear here")).toBeVisible();
    await expect(page.locator("text=Get print-ready files in seconds")).not.toBeVisible();

    // Refresh — still dismissed
    await page.reload();
    await expect(page.locator("text=Your export will appear here")).toBeVisible();
  });

  test("only ONE box in right panel (not two)", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    // Count boxes with border-border in the right panel area
    // The guide and info should be in the same container (merged)
    const boxes = page.locator(".rounded-xl.border.border-border.bg-surface");
    // On first visit: only the merged empty state box (1)
    // Previously it was 2 (separate onboarding + info boxes)
    const count = await boxes.count();
    expect(count).toBe(1);
  });
});

test.describe("Screenshots — integrated empty state", () => {
  test("packs desktop — guide mode", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    await page.evaluate(() => localStorage.removeItem("snaptosize_onboarding_dismissed"));
    await page.goto(`${BASE}/app/packs`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/packs-v3-guide.png", fullPage: true });
  });

  test("packs desktop — after dismiss", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    await page.evaluate(() => localStorage.setItem("snaptosize_onboarding_dismissed", "1"));
    await page.goto(`${BASE}/app/packs`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/packs-v3-standard.png", fullPage: true });
  });

  test("packs mobile — guide mode", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE}/app/packs`);
    await page.evaluate(() => localStorage.removeItem("snaptosize_onboarding_dismissed"));
    await page.goto(`${BASE}/app/packs`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/packs-v3-mobile-guide.png", fullPage: true });
  });
});
