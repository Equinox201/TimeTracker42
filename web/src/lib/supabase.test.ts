import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("supabase client", () => {
  it("can be imported without configuration (demo mode and previews)", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    await expect(import("./supabase")).resolves.toHaveProperty("supabase");
  });

  it("fails clearly on first real use when unconfigured", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const { supabase } = await import("./supabase");

    expect(() => supabase.auth).toThrow("Missing Supabase environment variables");
  });

  it("creates the client lazily and reuses it when configured", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    const { supabase } = await import("./supabase");

    expect(supabase.auth).toBe(supabase.auth);
    expect(typeof supabase.from).toBe("function");
  });
});
