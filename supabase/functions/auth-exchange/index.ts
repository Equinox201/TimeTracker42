import { createClient, type SupabaseClient } from "supabase";

import { bindingHashFor, bindingRequired, isVerifier } from "../_shared/binding.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { createLogger, errorMessage } from "../_shared/log.ts";

const corsMethods = "POST, OPTIONS";
const corsHeadersList = "authorization, x-client-info, apikey, content-type";

type SupabaseAdminClient = SupabaseClient;

type ExchangeRequestBody = {
  exchange_code?: unknown;
  verifier?: unknown;
};

type ExchangeRequest = {
  exchangeCode: string;
  // Present when the browser started the login with a binding; null for legacy clients.
  verifier: string | null;
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

async function readExchangeRequest(req: Request): Promise<ExchangeRequest | null> {
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

  if (body.verifier !== undefined && body.verifier !== null && !isVerifier(body.verifier)) {
    return null;
  }

  return { exchangeCode, verifier: typeof body.verifier === "string" ? body.verifier : null };
}

async function consumeExchangeCode(
  supabase: SupabaseAdminClient,
  request: ExchangeRequest,
  nowIso: string
): Promise<string | null> {
  const codeHash = await sha256Hex(request.exchangeCode);

  // The raw exchange code is never stored. This single conditional UPDATE both
  // validates and consumes the hashed code, preventing expired or replayed use.
  // The binding check is part of the same UPDATE: a wrong verifier matches no row, so it
  // neither redeems nor burns the code, and there is no read-then-write race.
  let query = supabase
    .from("auth_exchange_codes")
    .update({ used_at: nowIso })
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .gt("expires_at", nowIso);

  query = request.verifier
    ? query.eq("binding_hash", await bindingHashFor(request.verifier))
    : query.is("binding_hash", null);

  const { data, error } = await query.select("user_id").maybeSingle();

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
  const log = createLogger("auth-exchange");
  let supabaseUrl: string;
  let serviceRoleKey: string;
  let allowedOrigin: string;

  try {
    supabaseUrl = requiredEnv("EDGE_SUPABASE_URL");
    serviceRoleKey = requiredEnv("EDGE_SUPABASE_SERVICE_ROLE_KEY");
    allowedOrigin = appOriginValue(requiredEnv("APP_ORIGIN"));
  } catch (error) {
    log.error("config_incomplete", { reason: errorMessage(error) });
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
    log.warn("origin_rejected", { origin: req.headers.get("origin") });
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

  const exchangeRequest = await readExchangeRequest(req);
  if (!exchangeRequest) {
    log.warn("malformed_exchange_code");
    return jsonResponse(allowedOrigin, { error: "Invalid exchange code." }, 400);
  }

  if (!exchangeRequest.verifier && bindingRequired(Deno.env.get("REQUIRE_LOGIN_BINDING"))) {
    log.warn("verifier_missing");
    return jsonResponse(allowedOrigin, { error: "Invalid or expired exchange code." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const userId = await consumeExchangeCode(supabase, exchangeRequest, new Date().toISOString());
  if (!userId) {
    // Expired, replayed, or presented without the matching verifier. The cases are
    // deliberately indistinguishable to the caller.
    log.warn("exchange_code_rejected", { has_verifier: exchangeRequest.verifier !== null });
    return jsonResponse(allowedOrigin, { error: "Invalid or expired exchange code." }, 400);
  }

  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  const email = userData?.user?.email;
  if (userError || !email) {
    log.error("user_lookup_failed", { reason: userError ? errorMessage(userError) : "missing_email" });
    return jsonResponse(allowedOrigin, { error: "Could not prepare sign-in." }, 500);
  }

  try {
    const tokenHash = await generateEmailTokenHash(supabase, email);
    if (!tokenHash) {
      log.error("token_hash_missing");
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
  } catch (error) {
    log.error("token_hash_failed", { reason: errorMessage(error) });
    return jsonResponse(allowedOrigin, { error: "Could not prepare sign-in." }, 500);
  }
});
