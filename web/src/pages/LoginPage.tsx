import { FormEvent, useState } from "react";

import { enterDemoMode } from "../demo/demoMode";
import { functionsBaseUrl } from "../lib/functionsUrl";
import { beginLoginBinding } from "../lib/loginBinding";
import { supabase } from "../lib/supabase";
import { DashboardPreview } from "../components/marketing/DashboardPreview";
import { buttonClass } from "../components/ui/Button";
import { Banner } from "../components/ui/Banner";

function fortyTwoLoginUrl(binding: string | null): string {
  const url = new URL(`${functionsBaseUrl()}/forty-two-oauth-start`);
  url.searchParams.set("redirect_to", `${window.location.origin}/auth/callback`);
  if (binding) {
    url.searchParams.set("binding", binding);
  }
  return url.toString();
}

const enableEmailOtpFallback = import.meta.env.VITE_ENABLE_EMAIL_OTP_FALLBACK === "true";

export function LoginPage() {
  const wasDeleted = new URLSearchParams(window.location.search).get("deleted") === "1";
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

  const continueWithFortyTwo = async () => {
    // Ties this login to this browser: only a hash of the verifier leaves the page.
    const binding = await beginLoginBinding();
    window.location.assign(fortyTwoLoginUrl(binding));
  };

  const tryDemo = () => {
    enterDemoMode();
    window.location.assign("/app/main");
  };

  return (
    <div className="min-h-screen bg-tt42-bg text-tt42-text">
      <div className="mx-auto grid w-full max-w-5xl gap-12 px-5 py-10 md:grid-cols-2 md:items-center md:gap-14 md:px-8 md:py-20">
        <div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-tt42-accent text-[13px] font-bold tracking-tight text-tt42-on-accent"
            >
              42
            </span>
            <span className="text-base font-semibold tracking-tight">TimeTracker</span>
          </div>

          {wasDeleted ? (
            <Banner tone="success" className="mt-8 max-w-md">
              Your account and data were deleted. You can sign in again at any time to start fresh.
            </Banner>
          ) : null}

          <h1 className="mt-10 text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Know if you are on pace for your attendance goal.
          </h1>
          <p className="mt-4 max-w-md text-base text-tt42-muted">
            TimeTracker syncs your 42 campus attendance and tells you every day whether you are ahead or
            behind, and what it takes to reach your monthly target.
          </p>

          <div className="mt-8 flex max-w-sm flex-col gap-3">
            <button
              type="button"
              onClick={continueWithFortyTwo}
              className={buttonClass({ variant: "primary", className: "h-12 w-full text-base" })}
            >
              Continue with 42
            </button>
            <button
              type="button"
              onClick={tryDemo}
              className={buttonClass({ variant: "secondary", className: "h-12 w-full text-base" })}
            >
              Try the demo
            </button>
            <p className="text-xs text-tt42-muted">The demo uses sample data. No 42 account needed.</p>
          </div>

          <ul className="mt-10 max-w-md space-y-3 text-sm text-tt42-muted">
            <li className="flex gap-3">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tt42-accent" />
              <span>
                <strong className="font-medium text-tt42-text">Pace, not just totals.</strong> See how far
                ahead or behind you are today, not only how many hours you have.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tt42-accent" />
              <span>
                <strong className="font-medium text-tt42-text">Plan the rest of the month.</strong> Pick the days
                you can come in and find out whether the goal is reachable.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-tt42-accent" />
              <span>
                <strong className="font-medium text-tt42-text">Your 42 token stays on the server.</strong> The
                browser never sees it.
              </span>
            </li>
          </ul>

        {enableEmailOtpFallback ? (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-tt42-border" />
              <span className="text-xs uppercase tracking-[0.16em] text-tt42-muted">Development fallback</span>
              <div className="h-px flex-1 bg-tt42-border" />
            </div>

            <form className="space-y-4" onSubmit={sendMagicLink}>
              <label className="block text-sm">
                <span className="mb-1 block text-tt42-muted">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-lg border border-tt42-border bg-tt42-surface2 px-3 text-tt42-text outline-none focus:border-tt42-accent"
                />
              </label>

              <button
                type="submit"
                disabled={isSending}
                className={buttonClass({ variant: "secondary", className: "h-11 w-full" })}
              >
                {isSending ? "Sending..." : "Send magic link"}
              </button>
            </form>

            {successMessage ? (
              <Banner tone="success" className="mt-4">
                {successMessage}
              </Banner>
            ) : null}

            {errorMessage ? (
              <Banner tone="danger" className="mt-4">
                {errorMessage}
              </Banner>
            ) : null}

            <p className="mt-4 text-xs text-tt42-muted">
              Email OTP is hidden by default and intended only for development access.
            </p>
          </>
        ) : null}
        </div>

        <DashboardPreview />
      </div>
    </div>
  );
}
