// Small crypto helpers shared by the auth Edge Functions.

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

// 32 random bytes as base64url (43 characters): OAuth state, exchange codes.
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

export async function sha256Hex(value: string): Promise<string> {
  return Array.from(await sha256Bytes(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Base64Url(value: string): Promise<string> {
  return base64Url(await sha256Bytes(value));
}
