import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";

export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeOAuthSignIn } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const oneTimeCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("otc") ?? "";
  }, [location.search]);

  useEffect(() => {
    if (!oneTimeCode) {
      setErrorMessage("Missing one-time code in callback URL.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        await completeOAuthSignIn(oneTimeCode);
        if (!cancelled) {
          navigate("/app/main", { replace: true });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : "Sign-in failed.");
        setIsLoading(false);
      } finally {
        if (location.search) {
          window.history.replaceState(null, "", location.pathname);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [completeOAuthSignIn, navigate, oneTimeCode, location.pathname, location.search]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-10">
      <div className="w-full rounded-card border border-tt42-border bg-tt42-surface p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">Signing you in…</h1>
        <p className="mt-2 text-sm text-tt42-muted">Exchanging one-time code with backend.</p>

        {isLoading ? <p className="mt-4 text-sm text-tt42-muted">Please wait…</p> : null}

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-tt42-danger/40 bg-tt42-danger/10 p-3 text-sm text-tt42-danger">
            {errorMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <Link
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-tt42-border px-4"
            to="/login"
          >
            Back to login
          </Link>
        ) : null}
      </div>
    </div>
  );
}
