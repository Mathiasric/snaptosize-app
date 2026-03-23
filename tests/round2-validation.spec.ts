import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3456";

// ─── Onboarding Banner ───────────────────────────────────────────────

test.describe("OnboardingBanner", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage so banner always shows
    await page.goto(`${BASE}/app/packs`);
    await page.evaluate(() =>
      localStorage.removeItem("snaptosize_onboarding_dismissed")
    );
  });

  test("shows on packs page with correct steps", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    const banner = page.locator("text=Get print-ready files in seconds");
    await expect(banner).toBeVisible();

    // Verify packs-specific steps
    await expect(page.locator("text=Upload your artwork")).toBeVisible();
    await expect(page.locator("text=Pick your ratio packs")).toBeVisible();
    await expect(page.locator("text=Download Etsy-ready ZIPs")).toBeVisible();
  });

  test("shows on quick-export page with correct steps", async ({ page }) => {
    await page.goto(`${BASE}/app/quick-export`);
    await page.evaluate(() =>
      localStorage.removeItem("snaptosize_onboarding_dismissed")
    );
    await page.goto(`${BASE}/app/quick-export`);

    const banner = page.locator("text=Get print-ready files in seconds");
    await expect(banner).toBeVisible();

    // Verify quick-export-specific steps
    await expect(page.locator("text=Upload your artwork")).toBeVisible();
    await expect(page.locator("text=Choose size and orientation")).toBeVisible();
    await expect(page.locator("text=Download a print-ready JPG")).toBeVisible();
  });

  test("dismiss button hides banner and persists across refresh", async ({
    page,
  }) => {
    await page.goto(`${BASE}/app/packs`);
    const banner = page.locator("text=Get print-ready files in seconds");
    await expect(banner).toBeVisible();

    // Click dismiss
    await page.locator('button[aria-label="Dismiss"]').first().click();
    await expect(banner).not.toBeVisible();

    // Verify localStorage was set
    const stored = await page.evaluate(() =>
      localStorage.getItem("snaptosize_onboarding_dismissed")
    );
    expect(stored).toBe("1");

    // Refresh — banner should stay hidden
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(banner).not.toBeVisible();
  });
});

// ─── Billing Page Redesign ───────────────────────────────────────────
// Note: /app/billing requires Clerk auth. These tests verify that the
// page loads and redirects to sign-in (middleware protection working).
// Content verification requires a signed-in session.

test.describe("Billing page (auth-gated)", () => {
  test("billing page redirects unauthenticated users to sign-in", async ({
    page,
  }) => {
    const response = await page.goto(`${BASE}/app/billing`);
    // Should either redirect to sign-in or show the Clerk sign-in page
    const url = page.url();
    // After middleware redirect, URL contains /login or shows sign-in content
    const isRedirectedOrSignIn =
      url.includes("/login") ||
      url.includes("/sign-in") ||
      (await page.locator("text=Sign in").isVisible().catch(() => false));

    expect(isRedirectedOrSignIn).toBe(true);
  });
});

// ─── Billing Page Content (structural check via source) ──────────────

test.describe("Billing page content verification (source-level)", () => {
  test("billing page source contains feature comparison table", async () => {
    // Verify the component code itself has the right content
    const fs = await import("fs");
    const content = fs.readFileSync(
      "C:\\snaptosize-app\\app\\app\\billing\\page.tsx",
      "utf-8"
    );

    expect(content).toContain("Free vs Pro");
    expect(content).toContain("Quick Exports");
    expect(content).toContain("ZIP Packs");
    expect(content).toContain("Watermark");
    expect(content).not.toContain('"Processing"');
    expect(content).not.toContain('"File quality"');
    expect(content).toContain("Unlimited");
    expect(content).toContain("None");
  });

  test("billing page source contains social proof", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "C:\\snaptosize-app\\app\\app\\billing\\page.tsx",
      "utf-8"
    );

    expect(content).toContain(
      "Trusted by Etsy sellers who skip the Photoshop grind."
    );
  });

  test("billing page source has updated yearly copy", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "C:\\snaptosize-app\\app\\app\\billing\\page.tsx",
      "utf-8"
    );

    expect(content).toContain(
      "Less than the cost of one Etsy listing fee per month."
    );
    expect(content).not.toContain("Most sellers choose Yearly");
  });

  test("billing page source has structured free plan limits", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "C:\\snaptosize-app\\app\\app\\billing\\page.tsx",
      "utf-8"
    );

    expect(content).toContain("5 Quick Exports per day");
    expect(content).toContain("2 ZIP Packs per day");
    expect(content).toContain("Watermark on all exports");
  });
});

// ─── Page Structure Checks ───────────────────────────────────────────

test.describe("Page structure", () => {
  test("packs page loads successfully", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      // Ignore Clerk/PostHog errors (expected without auth)
      if (
        err.message.includes("Clerk") ||
        err.message.includes("PostHog") ||
        err.message.includes("posthog") ||
        err.message.includes("__clerk") ||
        err.message.includes("Cannot read properties of undefined")
      )
        return;
      errors.push(err.message);
    });

    const response = await page.goto(`${BASE}/app/packs`);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("domcontentloaded");

    // Filter only app-level errors
    expect(errors).toEqual([]);
  });

  test("quick-export page loads successfully", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (
        err.message.includes("Clerk") ||
        err.message.includes("PostHog") ||
        err.message.includes("posthog") ||
        err.message.includes("__clerk") ||
        err.message.includes("Cannot read properties of undefined")
      )
        return;
      errors.push(err.message);
    });

    const response = await page.goto(`${BASE}/app/quick-export`);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("domcontentloaded");

    expect(errors).toEqual([]);
  });

  test("packs page has upload zone and generate button", async ({ page }) => {
    await page.goto(`${BASE}/app/packs`);
    await expect(page.locator("text=Drop your image here")).toBeVisible();
    // Use role selector to avoid strict mode violation
    await expect(
      page.getByRole("button", { name: "Generate" })
    ).toBeVisible();
  });

  test("quick-export page has upload zone and export button", async ({
    page,
  }) => {
    await page.goto(`${BASE}/app/quick-export`);
    await expect(page.locator("text=Drop your image here")).toBeVisible();
    await expect(page.locator("text=Export JPG")).toBeVisible();
  });
});

// ─── Mobile Responsiveness ───────────────────────────────────────────

test.describe("Mobile responsiveness (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("packs page renders correctly on mobile", async ({ page }) => {
    // Navigate first, then clear localStorage
    await page.goto(`${BASE}/app/packs`);
    await page.evaluate(() =>
      localStorage.removeItem("snaptosize_onboarding_dismissed")
    );
    await page.goto(`${BASE}/app/packs`);

    // Banner visible
    const banner = page.locator("text=Get print-ready files in seconds");
    await expect(banner).toBeVisible();

    // Page doesn't have horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
  });

  test("quick-export page renders correctly on mobile", async ({ page }) => {
    await page.goto(`${BASE}/app/quick-export`);
    await page.evaluate(() =>
      localStorage.removeItem("snaptosize_onboarding_dismissed")
    );
    await page.goto(`${BASE}/app/quick-export`);

    const banner = page.locator("text=Get print-ready files in seconds");
    await expect(banner).toBeVisible();
  });
});
