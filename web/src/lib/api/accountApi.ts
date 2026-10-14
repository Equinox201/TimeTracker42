import { isDemoMode } from "../../demo/demoMode";
import { functionsBaseUrl } from "../functionsUrl";

// The word the user must type, and the server re-checks it.
export const DELETE_CONFIRMATION = "DELETE";

// Permanently deletes the signed-in user and everything stored for them (see the
// delete-account Edge Function). Never touches 42 itself.
export async function deleteAccount(accessToken: string): Promise<void> {
  if (isDemoMode()) {
    throw new Error("Deleting data is not available in demo mode.");
  }

  const response = await fetch(`${functionsBaseUrl()}/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ confirm: DELETE_CONFIRMATION })
  });

  if (response.ok) {
    return;
  }

  let message = "Could not delete your data. Please try again.";
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.length > 0) {
      message = body.error;
    }
  } catch {
    // Keep the generic message.
  }
  throw new Error(message);
}
