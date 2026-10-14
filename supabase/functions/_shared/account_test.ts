import { assertEquals } from "jsr:@std/assert@1";

import { DELETE_CONFIRMATION, parseDeleteRequest } from "./account.ts";

Deno.test("the exact confirmation word is accepted, with surrounding whitespace tolerated", () => {
  assertEquals(parseDeleteRequest({ confirm: DELETE_CONFIRMATION }), { ok: true });
  assertEquals(parseDeleteRequest({ confirm: "  DELETE\n" }), { ok: true });
});

Deno.test("anything else is a confirmation mismatch", () => {
  for (const confirm of ["delete", "Delete", "DELETE ME", "", "yes", 1, null, undefined, true]) {
    assertEquals(parseDeleteRequest({ confirm }), { ok: false, reason: "confirmation_mismatch" });
  }
  assertEquals(parseDeleteRequest({}), { ok: false, reason: "confirmation_mismatch" });
});

Deno.test("a body that is not an object is invalid", () => {
  for (const body of [null, undefined, "DELETE", 42, ["DELETE"], true]) {
    assertEquals(parseDeleteRequest(body), { ok: false, reason: "invalid_body" });
  }
});
