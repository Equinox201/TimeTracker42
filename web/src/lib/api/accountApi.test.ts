import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isDemoMode = vi.fn(() => false);
vi.mock("../../demo/demoMode", () => ({ isDemoMode: () => isDemoMode() }));

import { DELETE_CONFIRMATION, deleteAccount } from "./accountApi";

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_FUNCTIONS_URL", "https://example.functions.supabase.co");
  isDemoMode.mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("deleteAccount", () => {
  it("refuses in demo mode without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    isDemoMode.mockReturnValue(true);

    await expect(deleteAccount("token")).rejects.toThrow("not available in demo mode");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the confirmation with the bearer token to the function", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteAccount("access-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.functions.supabase.co/delete-account");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer access-token");
    expect(JSON.parse(String(init.body))).toEqual({ confirm: DELETE_CONFIRMATION });
  });

  it("surfaces the server's message on failure", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "Not authenticated." }), { status: 401 }));
    await expect(deleteAccount("bad")).rejects.toThrow("Not authenticated.");
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", async () => new Response("boom", { status: 502 }));
    await expect(deleteAccount("t")).rejects.toThrow("Could not delete your data");
  });
});
