import type { ConsoleMessage, Page } from "@playwright/test";

// Starts demo mode the way a visitor does: the button on the landing page.
export async function enterDemo(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: "Try the demo" }).click();
  await page.waitForURL("**/app/main");
  await page.getByRole("heading", { name: "Attendance", exact: true }).waitFor();
}

// Console errors that would mean something is broken for a real visitor.
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    // The generic "Failed to load resource" line carries no URL; failed responses are
    // reported below with theirs.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      errors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function goToTab(page: Page, name: "Main" | "History" | "Plan" | "Settings"): Promise<void> {
  // Phones show a bottom bar, desktop a side rail; only one of them is visible.
  await page.getByRole("link", { name }).first().click();
}
