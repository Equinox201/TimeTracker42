import { createClient } from "supabase";

const FORTY_TWO_TOKEN_URL = "https://api.intra.42.fr/oauth/token";
const FORTY_TWO_ME_URL = "https://api.intra.42.fr/v2/me";
const EXCHANGE_CODE_TTL_MS = 5 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

type SupabaseAdminClient = ReturnType<typeof createClient>;

type FortyTwoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type FortyTwoProfile = {
  id?: number;
  login?: string;
  displayname?: string;
  display_name?: string;
  email?: string;
  campus?: Array<{ id?: number }>;
  campus_users?: Array<{
    campus_id?: number;
    is_primary?: boolean;
  }>;
};

type VerifiedFortyTwoProfile = FortyTwoProfile & {
  id: number;
  login: string;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function generateExchangeCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function defaultCallbackUrl(appOrigin: string): string {
  return new URL("/auth/callback", appOrigin).toString();
}

function redirectWithParam(target: string, key: string, value: string): Response {
  const url = new URL(target);
  url.searchParams.set(key, value);
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: url.toString()
    }
  });
}

async function consumeOAuthState(
  supabase: SupabaseAdminClient,
  state: string,
  nowIso: string
): Promise<string | null> {
  const stateHash = await sha256Hex(state);

  // The raw OAuth state is never stored. This single UPDATE both validates and
  // consumes the matching hash, so replayed callback attempts cannot reuse it.
  const { data, error } = await supabase
    .from("oauth_states")
    .update({ used_at: nowIso })
    .eq("state_hash", stateHash)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("redirect_to")
    .maybeSingle();

  if (error || !data?.redirect_to) {
    return null;
  }

  return data.redirect_to;
}

async function exchangeFortyTwoCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<Required<Pick<FortyTwoTokenResponse, "access_token">> & FortyTwoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch(FORTY_TWO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error("42 token exchange failed");
  }

  const token = (await response.json()) as FortyTwoTokenResponse;
  if (!token.access_token) {
    throw new Error("42 token response missing access token");
  }

  return token as Required<Pick<FortyTwoTokenResponse, "access_token">> & FortyTwoTokenResponse;
}

async function fetchFortyTwoProfile(accessToken: string): Promise<VerifiedFortyTwoProfile> {
  const response = await fetch(FORTY_TWO_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("42 profile fetch failed");
  }

  const profile = (await response.json()) as FortyTwoProfile;
  if (typeof profile.id !== "number" || !profile.login) {
    throw new Error("42 profile missing stable identity");
  }

  return profile as VerifiedFortyTwoProfile;
}

function primaryCampusId(profile: VerifiedFortyTwoProfile): number | null {
  if (Array.isArray(profile.campus_users)) {
    const primaryCampus = profile.campus_users.find((campusUser) => campusUser.is_primary);
    if (typeof primaryCampus?.campus_id === "number") {
      return primaryCampus.campus_id;
    }

    const firstCampusUser = profile.campus_users.find(
      (campusUser) => typeof campusUser.campus_id === "number"
    );
    if (typeof firstCampusUser?.campus_id === "number") {
      return firstCampusUser.campus_id;
    }
  }

  if (Array.isArray(profile.campus)) {
    const firstCampus = profile.campus.find((campus) => typeof campus.id === "number");
    if (typeof firstCampus?.id === "number") {
      return firstCampus.id;
    }
  }

  return null;
}

async function findAuthUserBySyntheticEmail(
  supabase: SupabaseAdminClient,
  email: string
): Promise<string | null> {
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw error;
    }

    const users = data?.users ?? [];
    const existingUser = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (existingUser?.id) {
      return existingUser.id;
    }

    if (users.length < perPage) {
      return null;
    }
  }

  return null;
}

async function findOrCreateAppUser(
  supabase: SupabaseAdminClient,
  profile: VerifiedFortyTwoProfile,
  syntheticEmailDomain: string
): Promise<string> {
  const { data: existingProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("forty_two_user_id", profile.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (existingProfile?.id) {
    return existingProfile.id;
  }

  const syntheticEmail = `ft-${profile.id}@${syntheticEmailDomain}`;
  const existingAuthUserId = await findAuthUserBySyntheticEmail(supabase, syntheticEmail);
  if (existingAuthUserId) {
    return existingAuthUserId;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: syntheticEmail,
    email_confirm: true,
    user_metadata: {
      forty_two_user_id: profile.id,
      login: profile.login,
      display_name: profile.displayname ?? profile.display_name ?? profile.login
    },
    app_metadata: {
      provider: "forty_two",
      providers: ["forty_two"]
    }
  });

  if (error || !data.user?.id) {
    throw error ?? new Error("Supabase Auth user was not created");
  }

  return data.user.id;
}

async function upsertProfile(
  supabase: SupabaseAdminClient,
  userId: string,
  profile: VerifiedFortyTwoProfile,
  nowIso: string
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      forty_two_user_id: profile.id,
      forty_two_login: profile.login,
      display_name: profile.displayname ?? profile.display_name ?? profile.login,
      campus_id: primaryCampusId(profile),
      updated_at: nowIso
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

async function upsertFortyTwoTokens(
  supabase: SupabaseAdminClient,
  userId: string,
  token: Required<Pick<FortyTwoTokenResponse, "access_token">> & FortyTwoTokenResponse,
  nowIso: string
): Promise<void> {
  const expiresAt =
    typeof token.expires_in === "number"
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;

  const { error } = await supabase.from("forty_two_tokens").upsert(
    {
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: expiresAt,
      scope: token.scope ?? null,
      updated_at: nowIso
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }
}

async function createAuthExchangeCode(
  supabase: SupabaseAdminClient,
  userId: string
): Promise<string> {
  const exchangeCode = generateExchangeCode();
  const codeHash = await sha256Hex(exchangeCode);
  const expiresAt = new Date(Date.now() + EXCHANGE_CODE_TTL_MS).toISOString();

  // Store only the hash. The browser receives the raw short-lived code and a
  // later auth-exchange function will hash and consume it exactly once.
  const { error } = await supabase.from("auth_exchange_codes").insert({
    code_hash: codeHash,
    user_id: userId,
    expires_at: expiresAt,
    used_at: null
  });

  if (error) {
    throw error;
  }

  return exchangeCode;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: corsHeaders
      }
    );
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let fortyTwoClientId: string;
  let fortyTwoClientSecret: string;
  let fortyTwoRedirectUri: string;
  let syntheticEmailDomain: string;
  let appOrigin: string;

  try {
    supabaseUrl = requiredEnv("EDGE_SUPABASE_URL");
    serviceRoleKey = requiredEnv("EDGE_SUPABASE_SERVICE_ROLE_KEY");
    fortyTwoClientId = requiredEnv("FORTY_TWO_CLIENT_ID");
    fortyTwoClientSecret = requiredEnv("FORTY_TWO_CLIENT_SECRET");
    fortyTwoRedirectUri = requiredEnv("FORTY_TWO_REDIRECT_URI");
    syntheticEmailDomain = requiredEnv("FORTY_TWO_AUTH_EMAIL_DOMAIN");
    appOrigin = requiredEnv("APP_ORIGIN");
  } catch {
    return Response.json(
      { error: "Server configuration is incomplete." },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }

  const fallbackRedirectTo = defaultCallbackUrl(appOrigin);
  const requestUrl = new URL(req.url);
  const state = requestUrl.searchParams.get("state");
  if (!state) {
    return redirectWithParam(fallbackRedirectTo, "error", "invalid_state");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const nowIso = new Date().toISOString();
  const redirectTo = await consumeOAuthState(supabase, state, nowIso);
  if (!redirectTo) {
    return redirectWithParam(fallbackRedirectTo, "error", "invalid_state");
  }

  if (requestUrl.searchParams.get("error")) {
    return redirectWithParam(redirectTo, "error", "forty_two_denied");
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return redirectWithParam(redirectTo, "error", "missing_code");
  }

  let token: Required<Pick<FortyTwoTokenResponse, "access_token">> & FortyTwoTokenResponse;
  try {
    token = await exchangeFortyTwoCode(
      code,
      fortyTwoClientId,
      fortyTwoClientSecret,
      fortyTwoRedirectUri
    );
  } catch {
    return redirectWithParam(redirectTo, "error", "forty_two_exchange_failed");
  }

  let fortyTwoProfile: VerifiedFortyTwoProfile;
  try {
    fortyTwoProfile = await fetchFortyTwoProfile(token.access_token);
  } catch {
    return redirectWithParam(redirectTo, "error", "forty_two_profile_failed");
  }

  try {
    const userId = await findOrCreateAppUser(supabase, fortyTwoProfile, syntheticEmailDomain);
    const writeNowIso = new Date().toISOString();

    await upsertProfile(supabase, userId, fortyTwoProfile, writeNowIso);
    await upsertFortyTwoTokens(supabase, userId, token, writeNowIso);

    const exchangeCode = await createAuthExchangeCode(supabase, userId);
    return redirectWithParam(redirectTo, "exchange_code", exchangeCode);
  } catch {
    return redirectWithParam(redirectTo, "error", "auth_setup_failed");
  }
});
