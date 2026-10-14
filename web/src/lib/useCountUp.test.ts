import { describe, expect, it } from "vitest";

import { countUpValue, easeOutCubic } from "./useCountUp";

describe("easeOutCubic", () => {
  it("starts at 0, ends at 1 and is clamped outside the range", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });

  it("decelerates: more than half the distance in the first half of the time", () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe("countUpValue", () => {
  it("interpolates between the start and the target", () => {
    const mid = countUpValue(0, 100, 350, 700);
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(100);
  });

  it("lands exactly on the target when the duration has passed", () => {
    expect(countUpValue(10, 47.67, 700, 700)).toBe(47.67);
    expect(countUpValue(10, 47.67, 5_000, 700)).toBe(47.67);
  });

  it("returns the target at once for a zero duration", () => {
    expect(countUpValue(0, 5, 0, 0)).toBe(5);
  });

  it("counts down as well as up", () => {
    expect(countUpValue(100, 40, 100, 700)).toBeLessThan(100);
    expect(countUpValue(100, 40, 100, 700)).toBeGreaterThan(40);
  });
});
