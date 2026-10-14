// Browser binding for the 42 login flow (PKCE-style, no cookies).
//
// The browser keeps a random `verifier` and sends only its SHA-256 (`binding`) when it
// starts a login. The binding travels with the OAuth state and then with the one-time
// exchange code; redeeming the code requires the original verifier. A login finished by a
// different browser (login CSRF, an injected callback URL) cannot present it.

import { sha256Base64Url } from "./crypto.ts";

// SHA-256 digest as base64url: 32 bytes -> 43 characters.
const BINDING_HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export function isBindingHash(value: unknown): value is string {
  return typeof value === "string" && BINDING_HASH_PATTERN.test(value);
}

export function isVerifier(value: unknown): value is string {
  return typeof value === "string" && VERIFIER_PATTERN.test(value);
}

export function bindingHashFor(verifier: string): Promise<string> {
  return sha256Base64Url(verifier);
}

// When true, a login without a binding is refused. Leave it off while the frontend and the
// functions are deployed separately, then switch it on to stop downgrade attempts.
export function bindingRequired(rawFlag: string | null | undefined): boolean {
  return rawFlag?.trim().toLowerCase() === "true";
}
