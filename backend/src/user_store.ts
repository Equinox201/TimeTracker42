export type StoredTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // unix seconds
  scope?: string;
};

export type StoredGoals = {
  daily_goal_seconds: number;
  weekly_goal_seconds: number;
  monthly_goal_seconds: number;
  week_starts_on: "monday" | "sunday";
  timezone: string;
  updated_at: string;
};

export class UserStore {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/tokens") {
      const tokens = await this.state.storage.get<StoredTokens>("tokens");
      return Response.json(tokens ?? null);
    }

    if (request.method === "PUT" && url.pathname === "/tokens") {
      const body = (await request.json()) as StoredTokens;
      await this.state.storage.put("tokens", body);
      return new Response("ok");
    }

    if (request.method === "GET" && url.pathname === "/goals") {
      const goals = await this.state.storage.get<StoredGoals>("goals");
      return Response.json(goals ?? null);
    }

    if (request.method === "PUT" && url.pathname === "/goals") {
      const body = (await request.json()) as StoredGoals;
      await this.state.storage.put("goals", body);
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  }
}
