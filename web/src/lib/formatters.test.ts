import { describe, expect, it } from "vitest";

import { deltaHoursReadable, hoursToCompact, hoursToReadable, progressPercent, shortDateTime } from "./formatters";

describe("hoursToReadable", () => {
  it("formats hours and minutes", () => {
    expect(hoursToReadable(1.5)).toBe("1h 30m");
    expect(hoursToReadable(2)).toBe("2h");
    expect(hoursToReadable(0.25)).toBe("15m");
  });

  it("clamps negative and non-finite values to zero", () => {
    expect(hoursToReadable(-3)).toBe("0m");
    expect(hoursToReadable(Number.NaN)).toBe("0m");
  });
});

describe("hoursToCompact", () => {
  it("uses one decimal place", () => {
    expect(hoursToCompact(1.26)).toBe("1.3h");
    expect(hoursToCompact(-1)).toBe("0.0h");
  });
});

describe("deltaHoursReadable", () => {
  it("signs positive and negative deltas", () => {
    expect(deltaHoursReadable(2)).toBe("+2h");
    expect(deltaHoursReadable(-1.5)).toBe("-1h 30m");
    expect(deltaHoursReadable(0)).toBe("0m");
  });
});

describe("progressPercent", () => {
  it("rounds to a whole percent", () => {
    expect(progressPercent(5, 10)).toBe("50%");
    expect(progressPercent(1, 3)).toBe("33%");
  });

  it("returns 0% when there is no goal", () => {
    expect(progressPercent(5, 0)).toBe("0%");
  });
});

describe("shortDateTime", () => {
  it("returns Unknown for missing or invalid input", () => {
    expect(shortDateTime(null)).toBe("Unknown");
    expect(shortDateTime("garbage")).toBe("Unknown");
  });
});
