import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";

import { supabase } from "./supabase";

type AuthStatus = "booting" | "ready";

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

function stringMetadata(user: SupabaseUser, keys: string[]): string | null {
  for (const key of keys) {
    const value = user.user_metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function loginFromUser(user: SupabaseUser): string {
  const metadataLogin = stringMetadata(user, ["login", "user_name", "preferred_username", "nickname"]);
  if (metadataLogin) {
    return metadataLogin;
  }
  if (user.email) {
    return user.email.split("@")[0] ?? user.email;
  }
  return user.id;
}

function displayNameFromUser(user: SupabaseUser, login: string): string {
  return stringMetadata(user, ["display_name", "full_name", "name"]) ?? user.email ?? login;
}

function accessTokenExpiresAt(session: SupabaseSession): string {
  if (session.expires_at) {
    return new Date(session.expires_at * 1000).toISOString();
  }
  return new Date(Date.now() + session.expires_in * 1000).toISOString();
}

function adaptSession(session: SupabaseSession | null): SessionPayload | null {
  if (!session) {
    return null;
  }

  const login = loginFromUser(session.user);
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? "",
    tokenType: session.token_type,
    accessTokenExpiresAt: accessTokenExpiresAt(session),
    user: {
      id: session.user.id,
      login,
      displayName: displayNameFromUser(session.user, login)
    }
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("booting");
  const [session, setSession] = useState<SessionPayload | null>(null);

  const startOAuthUrl = useMemo(() => {
    return "#";
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }
      if (error) {
        setSession(null);
      } else {
        setSession(adaptSession(data.session));
      }
      setStatus("ready");
    };

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(adaptSession(nextSession));
      setStatus("ready");
    });

    void loadSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const completeOAuthSignIn = async () => {
    throw new Error("42 OAuth via Supabase Edge Functions is not implemented yet.");
  };

  const validAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      setSession(null);
      throw new Error("Not authenticated");
    }

    setSession(adaptSession(data.session));
    return data.session.access_token;
  };

  const signOut = async () => {
    setSession(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
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
