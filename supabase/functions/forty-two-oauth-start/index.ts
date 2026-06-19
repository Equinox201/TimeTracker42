import { createClient } from "supabase";

const OAUTH_AUTHORIZE_URL = "https://api.intra.42.fr/oauth/authorize";
const STATE_TTL_MS = 10 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: corsHeaders
    }
  );
}

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

function generateState(): string {
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

function appOriginUrl(appOrigin: string): URL {
  const parsed = new URL(appOrigin);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

function redirectTarget(requestUrl: URL, appOrigin: string): string {
  const origin = appOriginUrl(appOrigin);
  const requested = requestUrl.searchParams.get("redirect_to");
  if (!requested) {
    return new URL("/auth/callback", origin).toString();
  }

  const target = new URL(requested, origin);
  if (target.origin !== origin.origin) {
    throw new Error("Invalid redirect_to origin");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Invalid redirect_to protocol");
  }

  return target.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  if (req.method !== "GET") {
    return jsonError("Method not allowed", 405);
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let fortyTwoClientId: string;
  let fortyTwoRedirectUri: string;
  let appOrigin: string;

  try {
    supabaseUrl = requiredEnv("EDGE_SUPABASE_URL");
    serviceRoleKey = requiredEnv("EDGE_SUPABASE_SERVICE_ROLE_KEY");
    fortyTwoClientId = requiredEnv("FORTY_TWO_CLIENT_ID");
    fortyTwoRedirectUri = requiredEnv("FORTY_TWO_REDIRECT_URI");
    appOrigin = requiredEnv("APP_ORIGIN");
  } catch {
    return jsonError("Server configuration is incomplete.", 500);
  }

  let redirectTo: string;
  try {
    redirectTo = redirectTarget(new URL(req.url), appOrigin);
  } catch {
    return jsonError("Invalid redirect_to.", 400);
  }

  const state = generateState();
  const stateHash = await sha256Hex(state);
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  // Store only the SHA-256 hash of the OAuth state. The raw state travels
  // through the browser and 42 callback, while the callback function can hash
  // it again and consume this row once to reject CSRF and replay attempts.
  const { error } = await supabase.from("oauth_states").insert({
    state_hash: stateHash,
    redirect_to: redirectTo,
    expires_at: expiresAt
  });

  if (error) {
    return jsonError("Could not start OAuth flow.", 500);
  }

  const authorizeUrl = new URL(OAUTH_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", fortyTwoClientId);
  authorizeUrl.searchParams.set("redirect_uri", fortyTwoRedirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "public");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: authorizeUrl.toString()
    }
  });
});
