// fetch with a timeout and bounded retries for transient upstream failures.

export type FetchRetryOptions = {
  retries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

// Honours a numeric Retry-After (seconds), otherwise exponential backoff; always capped.
export function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  baseDelayMs = 500,
  maxDelayMs = 5_000
): number {
  const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  const requested = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : baseDelayMs * 2 ** attempt;
  return Math.min(Math.max(requested, 0), maxDelayMs);
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  options: FetchRetryOptions = {}
): Promise<Response> {
  const {
    retries = 2,
    timeoutMs = 10_000,
    baseDelayMs = 500,
    maxDelayMs = 5_000,
    fetchImpl = fetch,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  } = options;

  for (let attempt = 0; ; attempt += 1) {
    const isLastAttempt = attempt >= retries;

    try {
      const response = await fetchImpl(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (isLastAttempt || !isRetryableStatus(response.status)) {
        return response;
      }

      await response.body?.cancel();
      await sleep(retryDelayMs(attempt, response.headers.get("Retry-After"), baseDelayMs, maxDelayMs));
    } catch (error) {
      if (isLastAttempt) {
        throw error;
      }
      await sleep(retryDelayMs(attempt, null, baseDelayMs, maxDelayMs));
    }
  }
}
