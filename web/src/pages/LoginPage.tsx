import { FormEvent, useState } from "react";

import { supabase } from "../lib/supabase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextEmail = email.trim();
    if (!nextEmail) {
      setErrorMessage("Enter an email address.");
      return;
    }

    setIsSending(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    setIsSending(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(`Magic link sent to ${nextEmail}.`);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-10">
      <div className="w-full rounded-card border border-tt42-border bg-tt42-surface p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-tt42-muted">TimeTracker42</p>
        <h1 className="mt-2 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-3 text-sm text-tt42-muted">
          Use temporary email login to test Supabase Auth, RLS, and direct data access before 42 OAuth is connected.
        </p>

        <form className="mt-6 space-y-4" onSubmit={sendMagicLink}>
          <label className="block text-sm">
            <span className="mb-1 block text-tt42-muted">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3 text-tt42-text outline-none focus:border-tt42-magenta"
            />
          </label>

          <button
            type="submit"
            disabled={isSending}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-tt42-magenta to-tt42-teal font-medium text-black disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send magic link"}
          </button>
        </form>

        {successMessage ? (
          <p className="mt-4 rounded-xl border border-tt42-mint/40 bg-tt42-mint/15 p-3 text-sm text-tt42-text">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-tt42-danger/40 bg-tt42-danger/10 p-3 text-sm text-tt42-danger">
            {errorMessage}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-tt42-muted">
          42 OAuth is still pending. This temporary flow does not connect or sync 42 attendance data.
        </p>
      </div>
    </div>
  );
}
