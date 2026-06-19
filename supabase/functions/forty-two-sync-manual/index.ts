import { createClient } from "supabase";

const FORTY_TWO_TOKEN_URL = "https://api.intra.42.fr/oauth/token";
const FORTY_TWO_API_BASE_URL = "https://api.intra.42.fr/v2";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_FETCH = 50;
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

const corsMethods = "POST, OPTIONS";
const corsHeadersList = "authorization, x-client-info, apikey, content-type";

type SupabaseAdminClient = ReturnType<typeof createClient>;

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

type FortyTwoLocation = {
  id?: number;
  begin_at?: string | null;
  end_at?: string | null;
  host?: string | null;
  campus_id?: number | null;
  primary?: boolean | null;
};

type NormalizedLocationSession = {
  id: number;
  user_id: string;
  begin_at: string;
  end_at: string | null;
  host: string | null;
  campus_id: number | null;
  primary_location: boolean | null;
  synced_at: string;
};

type ExistingAttendanceRow = {
  day: string;
  seconds: number;
  source: string;
};

type DailyTotal = {
  seconds: number;
  hasLive: boolean;
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

function dateKeyInSingapore(value: Date): string {
  return new Date(value.getTime() + SINGAPORE_OFFSET_MS).toISOString().slice(0, 10);
}

function singaporeHistoricalWindowStart(value: Date): Date {
  const local = new Date(value.getTime() + SINGAPORE_OFFSET_MS);
  const year = local.getUTCFullYear();
  const monthIndex = local.getUTCMonth();
  const windowStart = new Date(Date.UTC(year, monthIndex - 5, 1));
  const month = String(windowStart.getUTCMonth() + 1).padStart(2, "0");
  return new Date(`${windowStart.getUTCFullYear()}-${month}-01T00:00:00+08:00`);
}

function singaporeDayStartMs(day: string): number {
  return Date.parse(`${day}T00:00:00+08:00`);
}

function nextSingaporeDayStartMs(day: string): number {
  return singaporeDayStartMs(day) + 86_400_000;
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

  const response = await fetch(FORTY_TWO_TOKEN_URL, {
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
  });

  if (!response.ok) {
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

async function createSyncRun(
  supabase: SupabaseAdminClient,
  userId: string,
  startedAt: string
): Promise<string> {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      user_id: userId,
      status: "running",
      started_at: startedAt
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data?.id) {
    throw new SafeSyncError("Could not create sync run.", 500);
  }

  return data.id;
}

async function updateSyncRun(
  supabase: SupabaseAdminClient,
  syncRunId: string,
  status: "success" | "failed",
  finishedAt: string,
  errorMessage?: string
): Promise<void> {
  await supabase
    .from("sync_runs")
    .update({
      status,
      finished_at: finishedAt,
      error: errorMessage ?? null
    })
    .eq("id", syncRunId);
}

function normalizeLocation(
  location: FortyTwoLocation,
  userId: string,
  syncedAt: string
): NormalizedLocationSession | null {
  if (typeof location.id !== "number" || !Number.isSafeInteger(location.id)) {
    return null;
  }

  if (!location.begin_at) {
    return null;
  }

  const beginMs = new Date(location.begin_at).getTime();
  if (!Number.isFinite(beginMs)) {
    return null;
  }

  if (location.end_at) {
    const endMs = new Date(location.end_at).getTime();
    if (!Number.isFinite(endMs)) {
      return null;
    }
  }

  return {
    id: location.id,
    user_id: userId,
    begin_at: location.begin_at,
    end_at: location.end_at ?? null,
    host: location.host ?? null,
    campus_id: typeof location.campus_id === "number" ? location.campus_id : null,
    primary_location: typeof location.primary === "boolean" ? location.primary : null,
    synced_at: syncedAt
  };
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

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

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

function uniqueLocations(locations: FortyTwoLocation[]): FortyTwoLocation[] {
  const byId = new Map<number, FortyTwoLocation>();

  for (const location of locations) {
    if (typeof location.id === "number") {
      byId.set(location.id, location);
    }
  }

  return Array.from(byId.values());
}

function computeDailyTotals(
  sessions: NormalizedLocationSession[],
  windowStart: Date,
  now: Date
): Map<string, DailyTotal> {
  const totals = new Map<string, DailyTotal>();
  const windowStartMs = windowStart.getTime();
  const nowMs = now.getTime();

  for (const session of sessions) {
    const beginMs = new Date(session.begin_at).getTime();
    const rawEndMs = session.end_at ? new Date(session.end_at).getTime() : nowMs;
    const startMs = Math.max(beginMs, windowStartMs);
    const endMs = Math.min(rawEndMs, nowMs);

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      continue;
    }

    let cursorMs = startMs;
    while (cursorMs < endMs) {
      const day = dateKeyInSingapore(new Date(cursorMs));
      const segmentEndMs = Math.min(endMs, nextSingaporeDayStartMs(day));
      const seconds = Math.max(0, Math.floor((segmentEndMs - cursorMs) / 1000));

      if (seconds > 0) {
        const total = totals.get(day) ?? { seconds: 0, hasLive: false };
        total.seconds += seconds;
        total.hasLive = total.hasLive || session.end_at === null;
        totals.set(day, total);
      }

      cursorMs = segmentEndMs;
    }
  }

  return totals;
}

async function loadExistingAttendance(
  supabase: SupabaseAdminClient,
  userId: string,
  days: string[]
): Promise<Map<string, ExistingAttendanceRow>> {
  if (days.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("attendance_daily")
    .select("day,seconds,source")
    .eq("user_id", userId)
    .in("day", days)
    .returns<ExistingAttendanceRow[]>();

  if (error) {
    throw new SafeSyncError("Could not load attendance.", 500);
  }

  return new Map(data.map((row) => [row.day, row]));
}

async function upsertLocationSessions(
  supabase: SupabaseAdminClient,
  sessions: NormalizedLocationSession[]
): Promise<void> {
  if (sessions.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("location_sessions")
    .upsert(sessions, { onConflict: "id" });

  if (error) {
    throw new SafeSyncError("Could not save location sessions.", 500);
  }
}

async function upsertAttendanceDaily(
  supabase: SupabaseAdminClient,
  userId: string,
  totals: Map<string, DailyTotal>,
  syncedAt: string
): Promise<{ insertedDays: number; updatedDays: number; unchangedDays: number }> {
  const days = Array.from(totals.keys()).sort();
  const existing = await loadExistingAttendance(supabase, userId, days);

  let insertedDays = 0;
  let updatedDays = 0;
  let unchangedDays = 0;

  const rows = days.map((day) => {
    const total = totals.get(day);
    if (!total) {
      throw new SafeSyncError("Could not compute attendance.", 500);
    }

    const source = total.hasLive ? "locations_live" : "locations";
    const current = existing.get(day);
    if (!current) {
      insertedDays += 1;
    } else if (current.seconds !== total.seconds || current.source !== source) {
      updatedDays += 1;
    } else {
      unchangedDays += 1;
    }

    return {
      user_id: userId,
      day,
      seconds: total.seconds,
      source,
      synced_at: syncedAt
    };
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("attendance_daily")
      .upsert(rows, { onConflict: "user_id,day" });

    if (error) {
      throw new SafeSyncError("Could not save attendance.", 500);
    }
  }

  return { insertedDays, updatedDays, unchangedDays };
}

Deno.serve(async (req) => {
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

  try {
    const userId = await authenticatedUserId(supabase, accessToken);
    const profile = await loadProfile(supabase, userId);
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

    const startedAt = new Date().toISOString();
    syncRunId = await createSyncRun(supabase, userId, startedAt);

    const now = new Date();
    const nowIso = now.toISOString();
    // Keep manual sync bounded while still making the six-month History view
    // useful: fetch from the first day of the month five months before the
    // current Singapore month through now. Active sessions are fetched
    // separately below so current-day live time is included.
    const windowStart = singaporeHistoricalWindowStart(now);
    const windowStartIso = windowStart.toISOString();
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
        "range[begin_at]": `${windowStartIso},${nowIso}`,
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

    await upsertLocationSessions(supabase, normalizedSessions);

    const totals = computeDailyTotals(normalizedSessions, windowStart, now);
    const counts = await upsertAttendanceDaily(supabase, userId, totals, nowIso);
    const finishedAt = new Date().toISOString();

    await updateSyncRun(supabase, syncRunId, "success", finishedAt);

    return jsonResponse(
      allowedOrigin,
      {
        syncRunId,
        status: "success",
        insertedDays: counts.insertedDays,
        updatedDays: counts.updatedDays,
        unchangedDays: counts.unchangedDays,
        startedAt,
        finishedAt
      },
      200
    );
  } catch (error) {
    const message = safeErrorMessage(error);
    const status = error instanceof SafeSyncError ? error.status : 500;
    if (syncRunId) {
      await updateSyncRun(supabase, syncRunId, "failed", new Date().toISOString(), message);
    }

    return jsonResponse(allowedOrigin, { error: message }, status);
  }
});
