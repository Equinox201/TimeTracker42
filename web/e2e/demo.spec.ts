import { expect, test } from "@playwright/test";

import { collectConsoleErrors, enterDemo, goToTab } from "./helpers";

test.describe("landing page", () => {
  test("states the value and offers the demo, with no console errors and no Supabase config", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/login");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("on pace");
    await expect(page.getByRole("button", { name: "Continue with 42" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
    await expect(page.getByText("Sample data for a fictional student")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("has a main landmark, a description and a real robots.txt", async ({ page, request }) => {
    await page.goto("/login");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);

    // Without a file the SPA fallback would answer with index.html, which is not valid robots.txt.
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("User-agent");
  });

  test("/demo deep link goes straight into the demo", async ({ page }) => {
    await page.goto("/demo");
    await page.waitForURL("**/app/main");
    await expect(page.getByText("Demo mode.")).toBeVisible();
  });

  test("protected pages send a signed-out visitor to the landing page", async ({ page }) => {
    await page.goto("/app/plan");
    await page.waitForURL("**/login");
  });
});

test.describe("dashboard", () => {
  test("answers 'ahead or behind?' and shows the supporting numbers", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await enterDemo(page);

    await expect(page.getByText("Demo mode.")).toBeVisible();
    await expect(page.getByText(/ahead of pace|behind pace|On pace|Goal reached/)).toBeVisible();
    for (const label of ["Today", "This week", "Hours left", "Needed per day"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("progressbar", { name: "Monthly goal progress" })).toBeVisible();
    await expect(page.getByText("Monthly attendance calendar", { exact: false })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("syncing in demo mode reports a result", async ({ page }) => {
    await enterDemo(page);
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByText(/Sync complete at/)).toBeVisible({ timeout: 10_000 });
  });

  test("exiting the demo returns to the landing page", async ({ page }) => {
    await enterDemo(page);
    await page.getByRole("button", { name: "Exit demo" }).click();
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: "Try the demo" })).toBeVisible();
  });
});

test.describe("planner", () => {
  test("tapping a day changes the plan and can be saved", async ({ page }) => {
    await enterDemo(page);
    await goToTab(page, "Plan");

    await expect(page.getByText("Tap a day to take it off")).toBeVisible();
    // A non-working day (weekend) that is still ahead: tapping makes it an extra working day.
    const restDay = page.getByRole("button", { name: /, not planned$/ }).first();
    await restDay.waitFor();
    const label = (await restDay.getAttribute("aria-label")) ?? "";
    const day = label.split(",")[0];

    await restDay.click();
    await expect(page.getByRole("button", { name: new RegExp(`^${day}, extra working day`) })).toBeVisible();
    await expect(page.getByText("Unsaved changes.")).toBeVisible();

    await page.getByRole("button", { name: "Save plan" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("a goal that does not fit the schedule says so and offers a fix", async ({ page }) => {
    await enterDemo(page);
    await goToTab(page, "Plan");

    await page.getByLabel("Most hours I will stay on one day").fill("1");
    await expect(page.getByText("Not reachable with this schedule")).toBeVisible();
    await expect(page.getByText("Ways to fix it")).toBeVisible();

    await page.getByRole("button", { name: "Apply" }).first().click();
    await expect(page.getByText("Unsaved changes.")).toBeVisible();
  });
});

test.describe("settings and history", () => {
  test("deadlines are measured from their own start date", async ({ page }) => {
    await enterDemo(page);
    await goToTab(page, "Settings");

    await expect(page.getByText("John Doe", { exact: true })).toBeVisible();
    await expect(page.getByText(/Counted from \d{4}-\d{2}-\d{2}/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the planner" })).toBeVisible();
  });

  test("history shows the monthly chart", async ({ page }) => {
    await enterDemo(page);
    await goToTab(page, "History");
    await expect(page.getByText("Last 6 Months")).toBeVisible();
  });

  test("the theme can be switched and is applied to the page", async ({ page }) => {
    await enterDemo(page);
    await goToTab(page, "Settings");

    await page.getByRole("button", { name: /^dark$/i }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: /^light$/i }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
