import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { Card } from "../components/ui/Card";
import { Banner } from "../components/ui/Banner";
import { buttonClass } from "../components/ui/Button";

export function AuthCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeOAuthSignIn } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const callbackUrl = useMemo(() => {
    return `${window.location.origin}${location.pathname}${location.search}${location.hash}`;
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!location.search && !location.hash) {
      setErrorMessage("Missing Supabase auth callback parameters.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        await completeOAuthSignIn(callbackUrl);
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
        if (location.search || location.hash) {
          window.history.replaceState(null, "", location.pathname);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, completeOAuthSignIn, location.hash, location.pathname, location.search, navigate]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-10">
      <Card as="div" padding="none" className="w-full p-6">
        <h1 className="text-2xl font-semibold">Signing you in…</h1>
        <p className="mt-2 text-sm text-tt42-muted">Completing Supabase session setup.</p>

        {isLoading ? <p className="mt-4 text-sm text-tt42-muted">Please wait…</p> : null}

        {errorMessage ? (
          <Banner tone="danger" className="mt-4">
            {errorMessage}
          </Banner>
        ) : null}

        {errorMessage ? (
          <Link
            className={buttonClass({ variant: "secondary", className: "mt-6 h-11" })}
            to="/login"
          >
            Back to login
          </Link>
        ) : null}
      </Card>
    </div>
  );
}
