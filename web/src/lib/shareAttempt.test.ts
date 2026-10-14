import { describe, expect, it, vi } from "vitest";

import { shareAttempt } from "./shareAttempt";

describe("shareAttempt", () => {
  it("runs the task once and shares the promise for the same key", async () => {
    const attempts = new Map<string, Promise<string>>();
    const start = vi.fn(async () => "token");

    const first = shareAttempt(attempts, "callback-url", start);
    const second = shareAttempt(attempts, "callback-url", start);

    expect(second).toBe(first);
    expect(await first).toBe("token");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("does not replay the task after it settled", async () => {
    const attempts = new Map<string, Promise<number>>();
    const start = vi.fn(async () => 1);

    await shareAttempt(attempts, "k", start);
    await shareAttempt(attempts, "k", start);

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("shares a rejection instead of retrying a consumed code", async () => {
    const attempts = new Map<string, Promise<void>>();
    const start = vi.fn(async () => {
      throw new Error("exchange rejected");
    });

    await expect(shareAttempt(attempts, "k", start)).rejects.toThrow("exchange rejected");
    await expect(shareAttempt(attempts, "k", start)).rejects.toThrow("exchange rejected");
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("keeps different keys independent", async () => {
    const attempts = new Map<string, Promise<string>>();
    const start = vi.fn(async () => "ok");

    await shareAttempt(attempts, "a", start);
    await shareAttempt(attempts, "b", start);

    expect(start).toHaveBeenCalledTimes(2);
  });
});
