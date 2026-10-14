import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

import {
  computeDailyTotals,
  daysToZero,
  normalizeLocation,
  singaporeHistoricalWindowStart,
  uniqueLocations,
  type NormalizedLocationSession
} from "./attendance.ts";

// All times below are written in Singapore time (+08:00), the app's attendance day.
const sgt = (value: string) => new Date(`${value}+08:00`);

let nextId = 1;
function session(begin: string, end: string | null): NormalizedLocationSession {
  return {
    id: nextId++,
    user_id: "user-1",
    begin_at: sgt(begin).toISOString(),
    end_at: end === null ? null : sgt(end).toISOString(),
    host: "e1r1p1",
    campus_id: 1,
    primary_location: true,
    synced_at: "2026-10-14T00:00:00.000Z"
  };
}

const WINDOW_START = sgt("2026-05-01T00:00:00");
const NOW = sgt("2026-10-14T18:00:00");

function totals(sessions: NormalizedLocationSession[], now = NOW) {
  return computeDailyTotals(sessions, WINDOW_START, now);
}

function secondsOn(result: ReturnType<typeof totals>, day: string): number {
  return result.get(day)?.seconds ?? 0;
}

Deno.test("overlapping sessions count elapsed presence once (09-11 + 10-12 = 3h)", () => {
  const result = totals([
    session("2026-10-14T09:00:00", "2026-10-14T11:00:00"),
    session("2026-10-14T10:00:00", "2026-10-14T12:00:00")
  ]);
  assertEquals(secondsOn(result, "2026-10-14"), 3 * 3600);
});

Deno.test("a session contained in another adds nothing", () => {
  const result = totals([
    session("2026-10-14T09:00:00", "2026-10-14T12:00:00"),
    session("2026-10-14T10:00:00", "2026-10-14T11:00:00")
  ]);
  assertEquals(secondsOn(result, "2026-10-14"), 3 * 3600);
});

Deno.test("touching sessions are merged without gaining or losing time", () => {
  const result = totals([
    session("2026-10-14T09:00:00", "2026-10-14T10:00:00"),
    session("2026-10-14T10:00:00", "2026-10-14T11:00:00")
  ]);
  assertEquals(secondsOn(result, "2026-10-14"), 2 * 3600);
});

Deno.test("separate sessions on one day are summed", () => {
  const result = totals([
    session("2026-10-14T09:00:00", "2026-10-14T10:00:00"),
    session("2026-10-14T14:00:00", "2026-10-14T16:30:00")
  ]);
  assertEquals(secondsOn(result, "2026-10-14"), 3.5 * 3600);
});

Deno.test("a session across Singapore midnight is split between both days", () => {
  // "now" must be after the session, otherwise it is (correctly) clipped away.
  const result = totals([session("2026-10-14T23:00:00", "2026-10-15T01:00:00")], sgt("2026-10-15T12:00:00"));
  assertEquals(secondsOn(result, "2026-10-14"), 3600);
  assertEquals(secondsOn(result, "2026-10-15"), 3600);
});

Deno.test("a session across a month boundary is split between months", () => {
  const result = totals([session("2026-09-30T23:30:00", "2026-10-01T00:30:00")]);
  assertEquals(secondsOn(result, "2026-09-30"), 1800);
  assertEquals(secondsOn(result, "2026-10-01"), 1800);
});

Deno.test("an open session runs until now and marks the day live", () => {
  const result = totals([
    session("2026-10-13T09:00:00", "2026-10-13T10:00:00"),
    session("2026-10-14T13:00:00", null)
  ]);
  assertEquals(secondsOn(result, "2026-10-14"), 5 * 3600);
  assert(result.get("2026-10-14")!.hasLive);
  assertFalse(result.get("2026-10-13")!.hasLive);
});

Deno.test("an open session that crossed midnight marks both days live", () => {
  const result = totals([session("2026-10-13T22:00:00", null)], sgt("2026-10-14T01:00:00"));
  assertEquals(secondsOn(result, "2026-10-13"), 2 * 3600);
  assertEquals(secondsOn(result, "2026-10-14"), 3600);
  assert(result.get("2026-10-13")!.hasLive && result.get("2026-10-14")!.hasLive);
});

Deno.test("a session starting before the window only counts from the window start", () => {
  const result = totals([session("2026-04-30T22:00:00", "2026-05-01T02:00:00")]);
  assertEquals(secondsOn(result, "2026-05-01"), 2 * 3600);
  assertFalse(result.has("2026-04-30"));
});

Deno.test("time after now and empty or inverted sessions are ignored", () => {
  const result = totals([
    session("2026-10-14T17:00:00", "2026-10-14T20:00:00"),
    session("2026-10-14T09:00:00", "2026-10-14T09:00:00"),
    session("2026-10-14T11:00:00", "2026-10-14T10:00:00")
  ]);
  assertEquals(secondsOn(result, "2026-10-14"), 3600);
});

Deno.test("recomputing from the same sessions gives the same totals (repeat sync is idempotent)", () => {
  const sessions = [
    session("2026-10-14T09:00:00", "2026-10-14T11:00:00"),
    session("2026-10-14T10:00:00", "2026-10-14T12:00:00"),
    session("2026-10-14T23:00:00", "2026-10-15T01:00:00")
  ];
  const later = sgt("2026-10-15T12:00:00");
  assertEquals(secondsOn(totals(sessions, later), "2026-10-15"), 3600);
  assertEquals(totals(sessions, later), totals([...sessions].reverse(), later));
  assertEquals(totals(sessions, later), totals(sessions, later));
});

Deno.test("historical window starts on the first of the month five months back (Singapore)", () => {
  assertEquals(
    singaporeHistoricalWindowStart(sgt("2026-10-14T12:00:00")).toISOString(),
    "2026-04-30T16:00:00.000Z"
  );
  // 2026-01-31 16:30 UTC is already 1 Feb in Singapore -> window starts 1 Sep 2025.
  assertEquals(
    singaporeHistoricalWindowStart(new Date("2026-01-31T16:30:00Z")).toISOString(),
    "2025-08-31T16:00:00.000Z"
  );
});

Deno.test("normalizeLocation rejects unusable rows and keeps valid ones", () => {
  const valid = { id: 7, begin_at: "2026-10-14T01:00:00.000Z", end_at: null, host: "h", campus_id: 1, primary: true };
  assertEquals(normalizeLocation(valid, "u", "t")?.id, 7);
  assertEquals(normalizeLocation({ ...valid, id: undefined }, "u", "t"), null);
  assertEquals(normalizeLocation({ ...valid, begin_at: null }, "u", "t"), null);
  assertEquals(normalizeLocation({ ...valid, begin_at: "nope" }, "u", "t"), null);
  assertEquals(normalizeLocation({ ...valid, end_at: "nope" }, "u", "t"), null);
});

Deno.test("uniqueLocations keeps one entry per id", () => {
  const result = uniqueLocations([
    { id: 1, begin_at: "a" },
    { id: 2, begin_at: "b" },
    { id: 1, begin_at: "c" },
    { begin_at: "no-id" }
  ]);
  assertEquals(result.length, 2);
  assertEquals(result.find((row) => row.id === 1)?.begin_at, "c");
});

Deno.test("daysToZero finds stored days the source no longer reports", () => {
  const computed = new Map([["2026-10-13", { seconds: 3600, hasLive: false }]]);
  const existing = [
    { day: "2026-10-12", seconds: 5400 }, // vanished -> zero
    { day: "2026-10-13", seconds: 3000 }, // still reported -> keep (updated elsewhere)
    { day: "2026-10-11", seconds: 0 }, // already zero
    { day: "2026-04-01", seconds: 100 } // outside the window
  ];
  assertEquals(daysToZero(existing, computed, "2026-05-01", "2026-10-14"), ["2026-10-12"]);
});
