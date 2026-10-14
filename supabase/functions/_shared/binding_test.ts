import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

import { bindingHashFor, bindingRequired, isBindingHash, isVerifier } from "./binding.ts";
import { base64Url, randomToken, sha256Base64Url, sha256Hex } from "./crypto.ts";

Deno.test("sha256 helpers match the published test vector for 'abc'", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
  assertEquals(await sha256Base64Url("abc"), "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
});

Deno.test("randomToken is 43 url-safe characters and unique", () => {
  const a = randomToken();
  const b = randomToken();
  assertEquals(a.length, 43);
  assert(/^[A-Za-z0-9_-]+$/.test(a));
  assert(a !== b);
});

Deno.test("base64Url strips padding and unsafe characters", () => {
  assertEquals(base64Url(new Uint8Array([251, 255, 254])), "-__-");
});

Deno.test("the hash of a generated verifier is a valid binding hash", async () => {
  const verifier = randomToken();
  assert(isVerifier(verifier));
  assert(isBindingHash(await bindingHashFor(verifier)));
});

Deno.test("a different verifier produces a different binding", async () => {
  const first = await bindingHashFor(randomToken());
  const second = await bindingHashFor(randomToken());
  assert(first !== second);
});

Deno.test("format validation rejects malformed values", () => {
  assertFalse(isBindingHash("short"));
  assertFalse(isBindingHash("a".repeat(44)));
  assertFalse(isBindingHash(`${"a".repeat(42)}=`));
  assertFalse(isBindingHash(null));
  assertFalse(isVerifier("a".repeat(42)));
  assertFalse(isVerifier("a".repeat(129)));
  assertFalse(isVerifier(`${"a".repeat(42)} `));
});

Deno.test("bindingRequired only accepts an explicit true", () => {
  assert(bindingRequired("true"));
  assert(bindingRequired(" TRUE "));
  assertFalse(bindingRequired(undefined));
  assertFalse(bindingRequired("1"));
  assertFalse(bindingRequired("false"));
});
