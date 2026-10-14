// Structured JSON logging shared by every Edge Function.
//
// One line per event, so the Supabase log explorer can filter on `fn`, `event`
// or `request_id`. Callers must never pass authorization codes, tokens, client
// secrets or e-mail addresses in `details`.

type Level = "info" | "warn" | "error";

export type Logger = {
  readonly requestId: string;
  info(event: string, details?: Record<string, unknown>): void;
  warn(event: string, details?: Record<string, unknown>): void;
  error(event: string, details?: Record<string, unknown>): void;
};

export function createLogger(fn: string): Logger {
  const requestId = crypto.randomUUID().slice(0, 8);

  const write = (level: Level, event: string, details: Record<string, unknown> = {}) => {
    const line = JSON.stringify({ level, fn, request_id: requestId, event, ...details });
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    requestId,
    info: (event, details) => write("info", event, details),
    warn: (event, details) => write("warn", event, details),
    error: (event, details) => write("error", event, details)
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
