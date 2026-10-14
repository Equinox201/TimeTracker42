import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { enterDemo, goToTab } from "./helpers";

// Automated checks catch roughly a third of accessibility problems (contrast, names, roles,
// landmarks). This is a floor, not a substitute for keyboard and screen-reader testing.
async function expectNoSeriousViolations(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  const summary = serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s)) e.g. ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `${where}\n${summary.join("\n")}`).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("landing page", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Try the demo" }).waitFor();
      await expectNoSeriousViolations(page, "landing");
    });

    test("dashboard", async ({ page }) => {
      await enterDemo(page);
      await page.getByRole("progressbar").waitFor();
      await expectNoSeriousViolations(page, "dashboard");
    });

    test("planner", async ({ page }) => {
      await enterDemo(page);
      await goToTab(page, "Plan");
      await page.getByText("Tap a day to take it off").waitFor();
      await expectNoSeriousViolations(page, "planner");
    });

    test("settings", async ({ page }) => {
      await enterDemo(page);
      await goToTab(page, "Settings");
      await page.getByText("John Doe", { exact: true }).waitFor();
      await expectNoSeriousViolations(page, "settings");
    });

    test("history", async ({ page }) => {
      await enterDemo(page);
      await goToTab(page, "History");
      await page.getByText("Last 6 Months").waitFor();
      await expectNoSeriousViolations(page, "history");
    });
  });
}
