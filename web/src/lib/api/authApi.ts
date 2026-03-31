import { appConfig } from "../config";

type SessionUserWire = {
  id: string;
  login: string;
  display_name: string;
};

type TokenPairResponseWire = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  access_token_expires_at: string;
  user: SessionUserWire;
};

export type SessionUser = {
  id: string;
  login: string;
  displayName: string;
};

export type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresAt: string;
  user: SessionUser;
};

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        detail = body.detail;
      }
    } catch {
      // No JSON body.
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

function normalizeTokenResponse(payload: TokenPairResponseWire): SessionPayload {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    tokenType: payload.token_type,
    accessTokenExpiresAt: payload.access_token_expires_at,
    user: {
      id: payload.user.id,
      login: payload.user.login,
      displayName: payload.user.display_name
    }
  };
}

export async function exchangeOneTimeCode(oneTimeCode: string): Promise<SessionPayload> {
  const payload = await requestJson<TokenPairResponseWire>("/api/v1/auth/mobile/exchange", {
    method: "POST",
    body: JSON.stringify({ one_time_code: oneTimeCode })
  });
  return normalizeTokenResponse(payload);
}

export async function refreshSession(refreshToken: string): Promise<SessionPayload> {
  const payload = await requestJson<TokenPairResponseWire>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  return normalizeTokenResponse(payload);
}

export async function logoutSession(refreshToken: string): Promise<void> {
  await requestJson<{ status: string }>("/api/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken })
  });
}
