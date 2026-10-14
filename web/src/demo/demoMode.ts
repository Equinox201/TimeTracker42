// Demo mode lets a visitor explore the whole app with synthetic data and no 42 account.
//
// The flag lives in sessionStorage so it survives a reload but not a new tab or session.
// Entering and leaving demo mode always does a full page load, which also guarantees the
// React Query cache never mixes demo data with a real account's data.

const STORAGE_KEY = "tt42.demo";

export const DEMO_USER = {
  id: "demo-user",
  login: "jdoe",
  displayName: "John Doe"
} as const;

// Fallback for browsers where sessionStorage throws (e.g. blocked site data).
let memoryFlag = false;

export function isDemoMode(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1" || memoryFlag;
  } catch {
    return memoryFlag;
  }
}

export function enterDemoMode(): void {
  memoryFlag = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // The in-memory flag still covers this page load.
  }
}

export function exitDemoMode(): void {
  memoryFlag = false;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
