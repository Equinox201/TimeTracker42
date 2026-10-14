// Browser half of the login binding (see supabase/functions/_shared/binding.ts).
//
// Before leaving for 42 the app creates a random verifier, keeps it in this browser and
// sends only its SHA-256 as `binding`. The one-time exchange code can then be redeemed only
// by a browser that still holds the verifier. localStorage (not sessionStorage) so a login
// that returns in a new tab or in-app browser window still finds it; entries expire.

const STORAGE_KEY = "tt42.login_binding";
const MAX_AGE_MS = 15 * 60 * 1000;

type StoredBinding = {
  verifier: string;
  createdAt: number;
};

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function createVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function bindingForVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

// Starts a login: stores a fresh verifier and returns the binding to send to the server.
// Returns null when storage is unavailable, in which case the login proceeds unbound.
export async function beginLoginBinding(now: number = Date.now()): Promise<string | null> {
  const verifier = createVerifier();
  const stored: StoredBinding = { verifier, createdAt: now };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    return null;
  }

  return bindingForVerifier(verifier);
}

// The verifier for the login in progress, or null if missing/expired. Not removed here, so
// a failed exchange can be retried; call clearLoginVerifier() after success.
export function peekLoginVerifier(now: number = Date.now()): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredBinding>;
    if (typeof parsed.verifier !== "string" || typeof parsed.createdAt !== "number") {
      return null;
    }
    if (now - parsed.createdAt > MAX_AGE_MS) {
      return null;
    }

    return parsed.verifier;
  } catch {
    return null;
  }
}

export function clearLoginVerifier(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
