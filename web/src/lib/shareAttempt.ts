// Runs `start` at most once per key and hands every later caller the same promise.
//
// Used for single-use credentials (the 42 exchange code): React effects can fire
// more than once, and replaying a consumed code is rejected by the server.
export function shareAttempt<T>(
  attempts: Map<string, Promise<T>>,
  key: string,
  start: () => Promise<T>
): Promise<T> {
  const existing = attempts.get(key);
  if (existing) {
    return existing;
  }

  const attempt = start();
  attempts.set(key, attempt);
  return attempt;
}
