import { appConfig } from "../config";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ErrorPayload = {
  detail?: string;
};

const REQUEST_TIMEOUT_MS = 15_000;

function buildAbortSignal(incomingSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();

  const onIncomingAbort = () => {
    controller.abort();
  };

  if (incomingSignal) {
    if (incomingSignal.aborted) {
      controller.abort();
    } else {
      incomingSignal.addEventListener("abort", onIncomingAbort, { once: true });
    }
  }

  const timeoutHandle = window.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutHandle);
      if (incomingSignal) {
        incomingSignal.removeEventListener("abort", onIncomingAbort);
      }
    }
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function normalizeNetworkError(error: unknown): Error {
  if (isAbortError(error)) {
    return new Error("Network timeout. Please retry.");
  }

  if (error instanceof TypeError) {
    return new Error("Network error. Check your connection and backend URL.");
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unexpected network error.");
}

export async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const { signal, cleanup } = buildAbortSignal(init.signal ?? undefined);

  let response: Response;
  try {
    response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
      cache: "no-store",
      credentials: "omit",
      ...init,
      signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {})
      }
    });
  } catch (error) {
    throw normalizeNetworkError(error);
  } finally {
    cleanup();
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as ErrorPayload;
      if (typeof body.detail === "string" && body.detail.trim().length > 0) {
        message = body.detail;
      }
    } catch {
      // Ignore invalid/non-JSON body.
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}
