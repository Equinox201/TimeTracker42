import { describe, expect, it } from "vitest";

import { todayLiveStatus } from "./liveStatus";

const row = (day: string, source: string) => ({ day, source, synced_at: `${day}T05:00:00.000Z` });

describe("todayLiveStatus", () => {
  it("is live when today's row came from an open session", () => {
    expect(todayLiveStatus([row("2026-10-13", "locations"), row("2026-10-14", "locations_live")], "2026-10-14")).toEqual({
      todayIsLive: true,
      liveCheckedAt: "2026-10-14T05:00:00.000Z"
    });
  });

  it("is not live when today's row is finalized", () => {
    expect(todayLiveStatus([row("2026-10-14", "locations")], "2026-10-14").todayIsLive).toBe(false);
  });

  it("ignores live rows from other days", () => {
    expect(todayLiveStatus([row("2026-10-13", "locations_live")], "2026-10-14")).toEqual({
      todayIsLive: false,
      liveCheckedAt: null
    });
  });

  it("is not live when there is no row for today", () => {
    expect(todayLiveStatus([], "2026-10-14").todayIsLive).toBe(false);
  });
});
