import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginLoginBinding,
  bindingForVerifier,
  clearLoginVerifier,
  createVerifier,
  peekLoginVerifier
} from "./loginBinding";

function installStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key)
  };
  vi.stubGlobal("window", { localStorage: storage });
  return data;
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bindingForVerifier", () => {
  it("is base64url(SHA-256) and matches the server-side test vector", async () => {
    // Same vector as supabase/functions/_shared/binding_test.ts.
    expect(await bindingForVerifier("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });

  it("produces the 43-character form the server validates", async () => {
    const binding = await bindingForVerifier(createVerifier());
    expect(binding).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("createVerifier", () => {
  it("is url-safe, long enough for the server, and unique", () => {
    const first = createVerifier();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(createVerifier()).not.toBe(first);
  });
});

describe("login binding lifecycle", () => {
  it("stores the verifier whose hash is returned", async () => {
    const binding = await beginLoginBinding(1_000);
    const verifier = peekLoginVerifier(1_000);

    expect(verifier).not.toBeNull();
    expect(await bindingForVerifier(verifier!)).toBe(binding);
  });

  it("keeps the verifier across a failed exchange until it is cleared", async () => {
    await beginLoginBinding(1_000);
    expect(peekLoginVerifier(2_000)).not.toBeNull();
    expect(peekLoginVerifier(2_000)).not.toBeNull();

    clearLoginVerifier();
    expect(peekLoginVerifier(2_000)).toBeNull();
  });

  it("expires after 15 minutes", async () => {
    await beginLoginBinding(0);
    expect(peekLoginVerifier(14 * 60 * 1000)).not.toBeNull();
    expect(peekLoginVerifier(16 * 60 * 1000)).toBeNull();
  });

  it("ignores corrupted storage", () => {
    const data = installStorage();
    data.set("tt42.login_binding", "{not json");
    expect(peekLoginVerifier()).toBeNull();
  });

  it("starts unbound when storage throws", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        }
      }
    });

    expect(await beginLoginBinding()).toBeNull();
    expect(peekLoginVerifier()).toBeNull();
  });
});
