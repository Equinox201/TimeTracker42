import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";

import { exchangeOneTimeCode, logoutSession, refreshSession, type SessionPayload } from "./api/authApi";

type AuthStatus = "booting" | "ready";

type AuthContextValue = {
  status: AuthStatus;
  isAuthenticated: boolean;
  session: SessionPayload | null;
  startOAuthUrl: string;
  completeOAuthSignIn: (oneTimeCode: string) => Promise<void>;
  validAccessToken: () => Promise<string>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseExpiry(isoValue: string): number {
  const parsed = Date.parse(isoValue);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("booting");
  const [session, setSession] = useState<SessionPayload | null>(null);

  const startOAuthUrl = useMemo(() => {
    const redirect = encodeURIComponent(callbackUrl());
    return `${import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"}/api/v1/auth/42/start?mobile_redirect_uri=${redirect}`;
  }, []);

  useEffect(() => {
    setStatus("ready");
  }, []);

  const persistSession = (next: SessionPayload | null) => {
    setSession(next);
  };

  const completeOAuthSignIn = async (oneTimeCode: string) => {
    const next = await exchangeOneTimeCode(oneTimeCode);
    persistSession(next);
  };

  const validAccessToken = async () => {
    if (!session) {
      throw new Error("Not authenticated");
    }

    const expiresAt = parseExpiry(session.accessTokenExpiresAt);
    const refreshWindow = Date.now() + 60_000;
    if (expiresAt > refreshWindow) {
      return session.accessToken;
    }

    try {
      const refreshed = await refreshSession(session.refreshToken);
      persistSession(refreshed);
      return refreshed.accessToken;
    } catch (error) {
      persistSession(null);
      throw error;
    }
  };

  const signOut = async () => {
    const refresh = session?.refreshToken ?? "";
    persistSession(null);
    if (!refresh) {
      return;
    }
    try {
      await logoutSession(refresh);
    } catch {
      // Best-effort logout; local session is already cleared.
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: !!session,
      session,
      startOAuthUrl,
      completeOAuthSignIn,
      validAccessToken,
      signOut
    }),
    [session, startOAuthUrl, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
