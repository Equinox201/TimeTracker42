import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

import { enterDemo, goToTab } from "./helpers";

// Regenerates the README images from demo mode: `npm run screenshots` (set PW_CHANNEL=chrome to
// use an installed Chrome). Skipped in normal test runs so CI never rewrites tracked files.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets/screenshots");

test.skip(!process.env.SCREENSHOTS, "Run with `npm run screenshots`");
test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: "dark" });

test("landing page", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).waitFor();
  await page.waitForTimeout(2500); // let the preview chart finish drawing
  await page.screenshot({ path: path.join(OUT, "landing.png") });
});

test("dashboard", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("progressbar").waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "dashboard.png") });
});

test("dashboard in the light theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await enterDemo(page);
  await page.getByRole("progressbar").waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "dashboard-light.png") });
});

test("planner", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await enterDemo(page);
  await goToTab(page, "Plan");
  await page.getByText("Tap a day to take it off").waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "planner.png") });
});
