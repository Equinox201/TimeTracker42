import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { isDemoMode } from "../../demo/demoMode";
import { DELETE_CONFIRMATION, deleteAccount } from "../../lib/api/accountApi";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

// "Delete my data": removes the account and everything stored for it. Typing the word is
// required, the server checks it again, and the action is unavailable in demo mode.
export function DeleteDataCard() {
  const { validAccessToken } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const demo = isDemoMode();
  const confirmed = confirmation.trim() === DELETE_CONFIRMATION;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteAccount(await validAccessToken());
    },
    onSuccess: async () => {
      try {
        // The user no longer exists server-side, so only clear this browser's session.
        await supabase.auth.signOut({ scope: "local" });
      } finally {
        window.location.assign("/login?deleted=1");
      }
    }
  });

  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.15em] text-tt42-muted">Your data</p>
      <h3 className="text-lg font-semibold">Delete my data</h3>

      <p className="mt-2 text-sm text-tt42-muted">
        This permanently deletes your account and everything TimeTracker42 stores about you: your 42 sign-in
        tokens, attendance history, goals, deadlines and plans. It does not change anything on 42. You can sign
        in again later, which starts fresh and syncs from 42 again.{" "}
        <a className="underline" href="https://github.com/Equinox201/TimeTracker42/blob/main/docs/privacy.md">
          What is stored and why
        </a>
        .
      </p>

      {demo ? (
        <Banner tone="info" className="mt-4">
          Not available in demo mode. There is no real account behind the demo.
        </Banner>
      ) : (
        <>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-tt42-muted">
              Type <strong className="font-semibold text-tt42-text">{DELETE_CONFIRMATION}</strong> to confirm
            </span>
            <input
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3"
            />
          </label>

          {deleteMutation.error ? (
            <Banner tone="danger" className="mt-3">
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : "Could not delete your data."}
            </Banner>
          ) : null}

          <div className="mt-4 flex justify-end">
            <Button
              variant="danger"
              disabled={!confirmed || deleteMutation.isPending}
              onClick={() => {
                deleteMutation.reset();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete my data"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
