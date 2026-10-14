// Validation for the delete-account request, kept pure so it can be tested.

export const DELETE_CONFIRMATION = "DELETE";

export type DeleteRequestResult =
  | { ok: true }
  | { ok: false; reason: "invalid_body" | "confirmation_mismatch" };

// Deleting is irreversible, so the caller must send the exact confirmation word.
export function parseDeleteRequest(body: unknown): DeleteRequestResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_body" };
  }

  const confirm = (body as { confirm?: unknown }).confirm;
  if (typeof confirm !== "string" || confirm.trim() !== DELETE_CONFIRMATION) {
    return { ok: false, reason: "confirmation_mismatch" };
  }

  return { ok: true };
}
