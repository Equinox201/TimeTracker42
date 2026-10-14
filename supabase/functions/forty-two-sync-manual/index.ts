import { createClient, type SupabaseClient } from "supabase";

import {
  computeDailyTotals,
  daysToZero,
  dateKeyInSingapore,
  normalizeLocation,
  singaporeHistoricalWindowStart,
  uniqueLocations,
  type FortyTwoLocation,
  type NormalizedLocationSession
} from "../_shared/attendance.ts";
import { fetchWithRetry } from "../_shared/http.ts";
import { createLogger, errorMessage } from "../_shared/log.ts";

const FORTY_TWO_TOKEN_URL = "https://api.intra.42.fr/oauth/token";
const FORTY_TWO_API_BASE_URL = "https://api.intra.42.fr/v2";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_FETCH = 50;
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
// Sessions that began shortly before the window can still overlap its first day.
const WINDOW_LOOKBACK_MS = 24 * 60 * 60 * 1000;
// A run still "running" after this long is considered abandoned (the function has a hard limit).
const STALE_RUN_MS = 10 * 60 * 1000;
const SYNC_COOLDOWN_MS = 15 * 1000;
const UPSTREAM_TIMEOUT_MS = 10_000;

const corsMethods = "POST, OPTIONS";
const corsHeadersList = "authorization, x-client-info, apikey, content-type";

type SupabaseAdminClient = SupabaseClient;

type ProfileRow = {
  id: string;
  forty_two_user_id: number | null;
};

type ConnectedProfileRow = ProfileRow & {
  forty_two_user_id: number;
};

type FortyTwoTokenRow = {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
};

type FortyTwoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type ExistingAttendanceRow = {
  day: string;
  seconds: number;
};

type FortyTwoTokenState = {
  token: FortyTwoTokenRow;
  retriedUnauthorized: boolean;
};

class SafeSyncError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

class FortyTwoUnauthorizedError extends SafeSyncError {
  constructor() {
    super("42 session expired. Please sign in again.", 401);
  }
}

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

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof SafeSyncError) {
    return error.message;
  }
  return "Manual sync failed.";
}

async function authenticatedUserId(
  supabase: SupabaseAdminClient,
  accessToken: string
): Promise<string> {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) {
    throw new SafeSyncError("Not authenticated.", 401);
  }
  return data.user.id;
}

async function loadProfile(
  supabase: SupabaseAdminClient,
  userId: string
): Promise<ConnectedProfileRow> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,forty_two_user_id")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new SafeSyncError("Could not load profile.", 500);
  }

  if (!data?.forty_two_user_id) {
    throw new SafeSyncError("42 account is not connected.", 400);
  }

  return data as ConnectedProfileRow;
}

async function loadFortyTwoToken(
  supabase: SupabaseAdminClient,
  userId: string
): Promise<FortyTwoTokenRow> {
  const { data, error } = await supabase
    .from("forty_two_tokens")
    .select("access_token,refresh_token,expires_at,scope")
    .eq("user_id", userId)
    .maybeSingle<FortyTwoTokenRow>();

  if (error) {
    throw new SafeSyncError("Could not load 42 token.", 500);
  }

  if (!data?.access_token) {
    throw new SafeSyncError("42 account is not connected.", 400);
  }

  return data;
}

function tokenNeedsRefresh(token: FortyTwoTokenRow): boolean {
  if (!token.refresh_token) {
    return false;
  }

  if (!token.expires_at) {
    return true;
  }

  const expiresAtMs = new Date(token.expires_at).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs - Date.now() <= TOKEN_REFRESH_SKEW_MS;
}

async function refreshFortyTwoToken(
  supabase: SupabaseAdminClient,
  userId: string,
  token: FortyTwoTokenRow,
  clientId: string,
  clientSecret: string
): Promise<FortyTwoTokenRow> {
  if (!token.refresh_token) {
    throw new SafeSyncError("42 session expired. Please sign in again.", 401);
  }

  let response: Response;
  try {
    // No retries: a refresh token may be rotated by the first attempt.
    response = await fetchWithRetry(
      FORTY_TWO_TOKEN_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: token.refresh_token
        })
      },
      { retries: 0, timeoutMs: UPSTREAM_TIMEOUT_MS }
    );
  } catch {
    throw new SafeSyncError("Could not reach 42. Please try again.", 504);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    createLogger("forty-two-sync-manual").error("token_refresh_rejected", {
      user_id: userId,
      status: response.status,
      detail
    });
    throw new SafeSyncError("42 session expired. Please sign in again.", 401);
  }

  const refreshed = (await response.json()) as FortyTwoTokenResponse;
  if (!refreshed.access_token) {
    throw new SafeSyncError("42 session expired. Please sign in again.", 401);
  }

  const nextToken: FortyTwoTokenRow = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token ?? token.refresh_token,
    expires_at:
      typeof refreshed.expires_in === "number"
        ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
        : token.expires_at,
    scope: refreshed.scope ?? token.scope
  };

  const { error } = await supabase
    .from("forty_two_tokens")
    .update({
      access_token: nextToken.access_token,
      refresh_token: nextToken.refresh_token,
      expires_at: nextToken.expires_at,
      scope: nextToken.scope,
      updated_at: new Date().toISOString()
    })
    .eq("user_id", userId);

  if (error) {
    throw new SafeSyncError("Could not update 42 token.", 500);
  }

  return nextToken;
}

async function closeRun(
  supabase: SupabaseAdminClient,
  syncRunId: string,
  errorMessageText: string,
  log: ReturnType<typeof createLogger>
): Promise<void> {
  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: errorMessageText
    })
    .eq("id", syncRunId);

  if (error) {
    // Do not mask the original failure; the stale-run recovery will close it later.
    log.error("sync_run_close_failed", { sync_run_id: syncRunId, reason: errorMessage(error) });
  }
}

// Takes the per-user sync lock by inserting a 'running' run (a partial unique index allows
// one per user). Recovers abandoned runs first and enforces a short cooldown.
async function acquireSyncRun(
  supabase: SupabaseAdminClient,
  userId: string,
  log: ReturnType<typeof createLogger>
): Promise<{ syncRunId: string; startedAt: string }> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data: recovered, error: recoverError } = await supabase
    .from("sync_runs")
    .update({ status: "failed", finished_at: nowIso, error: "Sync did not finish." })
    .eq("user_id", userId)
    .eq("status", "running")
    .lt("started_at", new Date(now - STALE_RUN_MS).toISOString())
    .select("id");

  if (recoverError) {
    throw new SafeSyncError("Could not start sync.", 500);
  }
  if (recovered && recovered.length > 0) {
    log.warn("abandoned_runs_recovered", { user_id: userId, count: recovered.length });
  }

  const { data: lastSuccess, error: lastError } = await supabase
    .from("sync_runs")
    .select("finished_at")
    .eq("user_id", userId)
    .eq("status", "success")
    .order("finished_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ finished_at: string | null }>();

  if (lastError) {
    throw new SafeSyncError("Could not start sync.", 500);
  }
  if (lastSuccess?.finished_at && now - new Date(lastSuccess.finished_at).getTime() < SYNC_COOLDOWN_MS) {
    log.info("sync_cooldown", { user_id: userId });
    throw new SafeSyncError("Synced a moment ago. Please wait a few seconds and try again.", 429);
  }

  const { data, error } = await supabase
    .from("sync_runs")
    .insert({ user_id: userId, status: "running", started_at: nowIso })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      log.info("sync_already_running", { user_id: userId });
      throw new SafeSyncError("A sync is already running. Please wait for it to finish.", 409);
    }
    throw new SafeSyncError("Could not create sync run.", 500);
  }

  return { syncRunId: data.id, startedAt: nowIso };
}

// Existing local totals in the window, used to zero days the source no longer reports.
async function loadExistingAttendance(
  supabase: SupabaseAdminClient,
  userId: string,
  fromDay: string,
  toDay: string
): Promise<ExistingAttendanceRow[]> {
  const { data, error } = await supabase
    .from("attendance_daily")
    .select("day,seconds")
    .eq("user_id", userId)
    .gte("day", fromDay)
    .lte("day", toDay)
    .gt("seconds", 0)
    .returns<ExistingAttendanceRow[]>();

  if (error) {
    throw new SafeSyncError("Could not load attendance.", 500);
  }

  return data;
}

async function fetchLocationsPage(
  accessToken: string,
  fortyTwoUserId: number,
  params: Record<string, string>,
  pageNumber: number
): Promise<FortyTwoLocation[]> {
  const url = new URL(
    `${FORTY_TWO_API_BASE_URL}/users/${encodeURIComponent(String(fortyTwoUserId))}/locations`
  );

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("page[size]", String(PAGE_SIZE));
  url.searchParams.set("page[number]", String(pageNumber));

  let response: Response;
  try {
    response = await fetchWithRetry(
      url,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      { retries: 2, timeoutMs: UPSTREAM_TIMEOUT_MS }
    );
  } catch {
    throw new SafeSyncError("42 did not respond in time. Please try again.", 504);
  }

  if (response.status === 401) {
    throw new FortyTwoUnauthorizedError();
  }

  if (response.status === 403) {
    throw new SafeSyncError("42 session expired. Please sign in again.", 401);
  }

  if (response.status === 429) {
    throw new SafeSyncError("42 rate limit reached. Please try again later.", 429);
  }

  if (!response.ok) {
    throw new SafeSyncError("Could not fetch 42 locations.", 502);
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as FortyTwoLocation[]) : [];
}

async function fetchPaginatedLocations(
  tokenState: FortyTwoTokenState,
  supabase: SupabaseAdminClient,
  userId: string,
  clientId: string,
  clientSecret: string,
  fortyTwoUserId: number,
  params: Record<string, string>
): Promise<FortyTwoLocation[]> {
  const locations: FortyTwoLocation[] = [];

  for (let pageNumber = 1; pageNumber <= MAX_PAGES_PER_FETCH; pageNumber += 1) {
    let page: FortyTwoLocation[];

    try {
      page = await fetchLocationsPage(tokenState.token.access_token, fortyTwoUserId, params, pageNumber);
    } catch (error) {
      if (error instanceof FortyTwoUnauthorizedError && !tokenState.retriedUnauthorized) {
        tokenState.token = await refreshFortyTwoToken(
          supabase,
          userId,
          tokenState.token,
          clientId,
          clientSecret
        );
        tokenState.retriedUnauthorized = true;
        page = await fetchLocationsPage(tokenState.token.access_token, fortyTwoUserId, params, pageNumber);
      } else {
        throw error;
      }
    }

    locations.push(...page);

    if (page.length < PAGE_SIZE) {
      return locations;
    }
  }

  throw new SafeSyncError("42 locations sync exceeded the safe pagination limit. Please try again later.", 502);
}

Deno.serve(async (req) => {
  const log = createLogger("forty-two-sync-manual");
  const requestStartedAt = Date.now();
  let supabaseUrl: string;
  let serviceRoleKey: string;
  let fortyTwoClientId: string;
  let fortyTwoClientSecret: string;
  let allowedOrigin: string;

  try {
    supabaseUrl = requiredEnv("EDGE_SUPABASE_URL");
    serviceRoleKey = requiredEnv("EDGE_SUPABASE_SERVICE_ROLE_KEY");
    fortyTwoClientId = requiredEnv("FORTY_TWO_CLIENT_ID");
    fortyTwoClientSecret = requiredEnv("FORTY_TWO_CLIENT_SECRET");
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

  const accessToken = bearerToken(req);
  if (!accessToken) {
    return jsonResponse(allowedOrigin, { error: "Not authenticated." }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  let syncRunId: string | null = null;
  let loggedUserId: string | null = null;

  try {
    const userId = await authenticatedUserId(supabase, accessToken);
    loggedUserId = userId;
    const profile = await loadProfile(supabase, userId);

    // Take the per-user lock before doing any upstream work.
    const run = await acquireSyncRun(supabase, userId, log);
    syncRunId = run.syncRunId;
    const startedAt = run.startedAt;

    let token = await loadFortyTwoToken(supabase, userId);
    if (tokenNeedsRefresh(token)) {
      token = await refreshFortyTwoToken(
        supabase,
        userId,
        token,
        fortyTwoClientId,
        fortyTwoClientSecret
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    // Keep manual sync bounded while still making the six-month History view
    // useful: from the first day of the month five months before the current
    // Singapore month through now. Sessions are requested from a day earlier
    // so one that began before the window but overlaps its first day is not
    // missed (it is clipped to the window when totals are computed). Active
    // sessions are fetched separately so current-day live time is included.
    const windowStart = singaporeHistoricalWindowStart(now);
    const fetchFromIso = new Date(windowStart.getTime() - WINDOW_LOOKBACK_MS).toISOString();
    const tokenState: FortyTwoTokenState = {
      token,
      retriedUnauthorized: false
    };
    const rangeLocations = await fetchPaginatedLocations(
      tokenState,
      supabase,
      userId,
      fortyTwoClientId,
      fortyTwoClientSecret,
      profile.forty_two_user_id,
      {
        "range[begin_at]": `${fetchFromIso},${nowIso}`,
        sort: "begin_at"
      }
    );
    const activeLocations = await fetchPaginatedLocations(
      tokenState,
      supabase,
      userId,
      fortyTwoClientId,
      fortyTwoClientSecret,
      profile.forty_two_user_id,
      {
        "filter[active]": "true",
        sort: "begin_at"
      }
    );

    const normalizedSessions = uniqueLocations([...rangeLocations, ...activeLocations])
      .map((location) => normalizeLocation(location, userId, nowIso))
      .filter((session): session is NormalizedLocationSession => session !== null);

    const totals = computeDailyTotals(normalizedSessions, windowStart, now);

    // Every fetch above completed (a failed or truncated one throws), so a stored day with
    // no sessions was removed upstream. An entirely empty result is treated as suspicious
    // and never wipes history.
    const windowStartDay = dateKeyInSingapore(windowStart);
    const todayDay = dateKeyInSingapore(now);
    const existing = await loadExistingAttendance(supabase, userId, windowStartDay, todayDay);
    const zeroedDays = normalizedSessions.length === 0 ? [] : daysToZero(existing, totals, windowStartDay, todayDay);
    if (normalizedSessions.length === 0 && existing.length > 0) {
      log.warn("empty_result_skipped_reconcile", { user_id: userId, stored_days: existing.length });
    }

    const days = [
      ...Array.from(totals.entries()).map(([day, total]) => ({
        day,
        seconds: total.seconds,
        source: total.hasLive ? "locations_live" : "locations"
      })),
      ...zeroedDays.map((day) => ({ day, seconds: 0, source: "locations" }))
    ].sort((a, b) => a.day.localeCompare(b.day));

    const finishedAt = new Date().toISOString();

    // One transaction: sessions, daily totals and the run status land together or not at all.
    const { data: counts, error: finalizeError } = await supabase
      .rpc("finalize_sync", {
        p_user_id: userId,
        p_run_id: syncRunId,
        p_sessions: normalizedSessions.map(({ user_id: _userId, synced_at: _syncedAt, ...session }) => session),
        p_days: days,
        p_synced_at: nowIso,
        p_finished_at: finishedAt
      })
      .single<{ inserted_days: number; updated_days: number; unchanged_days: number }>();

    if (finalizeError || !counts) {
      log.error("finalize_failed", { user_id: userId, sync_run_id: syncRunId, reason: errorMessage(finalizeError) });
      throw new SafeSyncError("Could not save attendance.", 500);
    }

    log.info("sync_completed", {
      user_id: userId,
      sync_run_id: syncRunId,
      sessions: normalizedSessions.length,
      inserted_days: counts.inserted_days,
      updated_days: counts.updated_days,
      zeroed_days: zeroedDays.length,
      duration_ms: Date.now() - requestStartedAt
    });

    return jsonResponse(
      allowedOrigin,
      {
        syncRunId,
        status: "success",
        insertedDays: counts.inserted_days,
        updatedDays: counts.updated_days,
        unchangedDays: counts.unchanged_days,
        startedAt,
        finishedAt
      },
      200
    );
  } catch (error) {
    const message = safeErrorMessage(error);
    const status = error instanceof SafeSyncError ? error.status : 500;
    log.error("sync_failed", {
      user_id: loggedUserId,
      sync_run_id: syncRunId,
      status,
      reason: errorMessage(error),
      duration_ms: Date.now() - requestStartedAt
    });
    if (syncRunId) {
      await closeRun(supabase, syncRunId, message, log);
    }

    return jsonResponse(allowedOrigin, { error: message }, status);
  }
});
