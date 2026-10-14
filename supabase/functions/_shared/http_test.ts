import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { fetchWithRetry, isRetryableStatus, retryDelayMs } from "./http.ts";

function stubFetch(responses: Array<Response | Error>) {
  const calls: number[] = [];
  const impl = (_input: string | URL | Request, init?: RequestInit) => {
    calls.push(Date.now());
    if (!init?.signal) {
      throw new Error("a timeout signal must always be attached");
    }
    const next = responses.shift();
    if (next === undefined) {
      throw new Error("unexpected extra request");
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { impl: impl as typeof fetch, calls };
}

function sleeper() {
  const delays: number[] = [];
  return { sleep: (ms: number) => { delays.push(ms); return Promise.resolve(); }, delays };
}

Deno.test("retryable statuses are rate limits and gateway errors only", () => {
  for (const status of [429, 502, 503, 504]) {
    assertEquals(isRetryableStatus(status), true);
  }
  for (const status of [200, 400, 401, 403, 404, 500]) {
    assertEquals(isRetryableStatus(status), false);
  }
});

Deno.test("retryDelayMs honours Retry-After, backs off otherwise, and is capped", () => {
  assertEquals(retryDelayMs(0, "2"), 2000);
  assertEquals(retryDelayMs(0, "120"), 5000);
  assertEquals(retryDelayMs(0, null), 500);
  assertEquals(retryDelayMs(2, null), 2000);
  assertEquals(retryDelayMs(10, null), 5000);
  assertEquals(retryDelayMs(0, "Wed, 21 Oct 2026 07:28:00 GMT"), 500);
});

Deno.test("429 then 200 returns the success after waiting", async () => {
  const { impl, calls } = stubFetch([
    new Response("slow down", { status: 429, headers: { "Retry-After": "1" } }),
    new Response("ok", { status: 200 })
  ]);
  const { sleep, delays } = sleeper();

  const response = await fetchWithRetry("https://example.test", {}, { fetchImpl: impl, sleep });

  assertEquals(response.status, 200);
  assertEquals(calls.length, 2);
  assertEquals(delays, [1000]);
});

Deno.test("persistent 429 returns the last response after the retry budget", async () => {
  const { impl, calls } = stubFetch([
    new Response("", { status: 429 }),
    new Response("", { status: 429 }),
    new Response("", { status: 429 })
  ]);
  const { sleep } = sleeper();

  const response = await fetchWithRetry("https://example.test", {}, { fetchImpl: impl, sleep, retries: 2 });

  assertEquals(response.status, 429);
  assertEquals(calls.length, 3);
});

Deno.test("a client error is returned immediately without retrying", async () => {
  const { impl, calls } = stubFetch([new Response("", { status: 404 })]);
  const { sleep, delays } = sleeper();

  const response = await fetchWithRetry("https://example.test", {}, { fetchImpl: impl, sleep });

  assertEquals(response.status, 404);
  assertEquals(calls.length, 1);
  assertEquals(delays.length, 0);
});

Deno.test("a network error is retried and then succeeds", async () => {
  const { impl, calls } = stubFetch([new TypeError("connection reset"), new Response("ok", { status: 200 })]);
  const { sleep } = sleeper();

  const response = await fetchWithRetry("https://example.test", {}, { fetchImpl: impl, sleep });

  assertEquals(response.status, 200);
  assertEquals(calls.length, 2);
});

Deno.test("a network error that persists is rethrown", async () => {
  const { impl } = stubFetch([new TypeError("a"), new TypeError("b"), new TypeError("c")]);
  const { sleep } = sleeper();

  await assertRejects(
    () => fetchWithRetry("https://example.test", {}, { fetchImpl: impl, sleep, retries: 2 }),
    TypeError,
    "c"
  );
});

Deno.test("retries: 0 makes exactly one attempt", async () => {
  const { impl, calls } = stubFetch([new Response("", { status: 503 })]);
  const { sleep } = sleeper();

  const response = await fetchWithRetry("https://example.test", {}, { fetchImpl: impl, sleep, retries: 0 });

  assertEquals(response.status, 503);
  assertEquals(calls.length, 1);
});
