import { createClient } from "supabase";

import { parseDeleteRequest } from "../_shared/account.ts";
import { createLogger, errorMessage } from "../_shared/log.ts";

// Permanently deletes the signed-in user. Every user-owned table references auth.users with
// ON DELETE CASCADE, so removing the auth user removes the profile, 42 tokens, attendance,
// sessions, goals, deadlines, plans, sync runs and any pending exchange codes in one step.

const corsMethods = "POST, OPTIONS";
const corsHeadersList = "authorization, x-client-info, apikey, content-type";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function corsHeaders(allowedOrigin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": corsHeadersList,
    "Access-Control-Allow-Methods": corsMethods,
    "Vary": "Origin"
  };
}

function jsonResponse(allowedOrigin: string, body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: corsHeaders(allowedOrigin) });
}

function bearerToken(req: Request): string | null {
  const match = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

Deno.serve(async (req) => {
  const log = createLogger("delete-account");

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let allowedOrigin: string;

  try {
    supabaseUrl = requiredEnv("EDGE_SUPABASE_URL");
    serviceRoleKey = requiredEnv("EDGE_SUPABASE_SERVICE_ROLE_KEY");
    allowedOrigin = new URL(requiredEnv("APP_ORIGIN")).origin;
  } catch (error) {
    log.error("config_incomplete", { reason: errorMessage(error) });
    return Response.json(
      { error: "Server configuration is incomplete." },
      { status: 500, headers: { "Access-Control-Allow-Origin": "null", Vary: "Origin" } }
    );
  }

  const origin = req.headers.get("Origin");
  if (origin && origin !== allowedOrigin) {
    log.warn("origin_rejected", { origin });
    return jsonResponse(allowedOrigin, { error: "Origin not allowed." }, 403);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }

  if (req.method !== "POST") {
    return jsonResponse(allowedOrigin, { error: "Method not allowed." }, 405);
  }

  const accessToken = bearerToken(req);
  if (!accessToken) {
    return jsonResponse(allowedOrigin, { error: "Not authenticated." }, 401);
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // Falls through to the validator, which rejects a missing body.
  }

  const request = parseDeleteRequest(body);
  if (!request.ok) {
    log.warn("delete_rejected", { reason: request.reason });
    return jsonResponse(allowedOrigin, { error: "Type DELETE to confirm." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  const userId = userData.user?.id;
  if (userError || !userId) {
    return jsonResponse(allowedOrigin, { error: "Not authenticated." }, 401);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    log.error("delete_failed", { user_id: userId, reason: errorMessage(deleteError) });
    return jsonResponse(allowedOrigin, { error: "Could not delete your data. Please try again." }, 500);
  }

  log.info("account_deleted", { user_id: userId });
  return jsonResponse(allowedOrigin, { deleted: true }, 200);
});
