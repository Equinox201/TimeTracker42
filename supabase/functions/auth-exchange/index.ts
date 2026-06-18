import { createClient } from "supabase";

const corsMethods = "POST, OPTIONS";
const corsHeadersList = "authorization, x-client-info, apikey, content-type";

type SupabaseAdminClient = ReturnType<typeof createClient>;

type ExchangeRequestBody = {
  exchange_code?: unknown;
};

type GenerateLinkData = {
  properties?: {
    hashed_token?: string;
  };
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function appOriginValue(appOrigin: string): string {
  return new URL(appOrigin).origin;
}

function corsHeaders(allowedOrigin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": corsHeadersList,
    "Access-Control-Allow-Methods": corsMethods,
    "Vary": "Origin"
  };
}

function jsonResponse(
  allowedOrigin: string,
  body: Record<string, unknown>,
  status: number
): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders(allowedOrigin)
  });
}

function originAllowed(req: Request, allowedOrigin: string): boolean {
  const origin = req.headers.get("Origin");
  return !origin || origin === allowedOrigin;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readExchangeCode(req: Request): Promise<string | null> {
  let body: ExchangeRequestBody;

  try {
    body = (await req.json()) as ExchangeRequestBody;
  } catch {
    return null;
  }

  if (typeof body.exchange_code !== "string") {
    return null;
  }

  const exchangeCode = body.exchange_code.trim();
  if (exchangeCode.length < 32 || exchangeCode.length > 256) {
    return null;
  }

  return exchangeCode;
}

async function consumeExchangeCode(
  supabase: SupabaseAdminClient,
  exchangeCode: string,
  nowIso: string
): Promise<string | null> {
  const codeHash = await sha256Hex(exchangeCode);

  // The raw exchange code is never stored. This single conditional UPDATE both
  // validates and consumes the hashed code, preventing expired or replayed use.
  const { data, error } = await supabase
    .from("auth_exchange_codes")
    .update({ used_at: nowIso })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("user_id")
    .maybeSingle();

  if (error || !data?.user_id) {
    return null;
  }

  return data.user_id;
}

async function generateEmailTokenHash(
  supabase: SupabaseAdminClient,
  email: string
): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email
  });

  if (error) {
    throw error;
  }

  // Supabase generateLink exposes the verifier for verifyOtp as
  // properties.hashed_token. Do not return action links or session tokens.
  const tokenHash = (data as GenerateLinkData | null)?.properties?.hashed_token;
  return typeof tokenHash === "string" && tokenHash.length > 0 ? tokenHash : null;
}

Deno.serve(async (req) => {
  let supabaseUrl: string;
  let serviceRoleKey: string;
  let allowedOrigin: string;

  try {
    supabaseUrl = requiredEnv("EDGE_SUPABASE_URL");
    serviceRoleKey = requiredEnv("EDGE_SUPABASE_SERVICE_ROLE_KEY");
    allowedOrigin = appOriginValue(requiredEnv("APP_ORIGIN"));
  } catch {
    return Response.json(
      { error: "Server configuration is incomplete." },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "null",
          "Vary": "Origin"
        }
      }
    );
  }

  if (!originAllowed(req, allowedOrigin)) {
    return jsonResponse(allowedOrigin, { error: "Origin not allowed." }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(allowedOrigin)
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(allowedOrigin, { error: "Method not allowed." }, 405);
  }

  const exchangeCode = await readExchangeCode(req);
  if (!exchangeCode) {
    return jsonResponse(allowedOrigin, { error: "Invalid exchange code." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const userId = await consumeExchangeCode(supabase, exchangeCode, new Date().toISOString());
  if (!userId) {
    return jsonResponse(allowedOrigin, { error: "Invalid or expired exchange code." }, 400);
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (userError || !email) {
    return jsonResponse(allowedOrigin, { error: "Could not prepare sign-in." }, 500);
  }

  try {
    const tokenHash = await generateEmailTokenHash(supabase, email);
    if (!tokenHash) {
      return jsonResponse(allowedOrigin, { error: "Could not prepare sign-in." }, 500);
    }

    return jsonResponse(
      allowedOrigin,
      {
        token_hash: tokenHash,
        type: "email"
      },
      200
    );
  } catch {
    return jsonResponse(allowedOrigin, { error: "Could not prepare sign-in." }, 500);
  }
});
