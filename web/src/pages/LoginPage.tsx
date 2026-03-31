import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { startOAuthUrl } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-10">
      <div className="w-full rounded-card border border-tt42-border bg-tt42-surface p-6 shadow-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-tt42-muted">TimeTracker42</p>
        <h1 className="mt-2 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-3 text-sm text-tt42-muted">
          Sign in with 42 to access your attendance, goals, and deadlines.
        </p>

        <a
          href={startOAuthUrl}
          className="mt-6 flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-tt42-magenta to-tt42-teal font-medium text-black"
        >
          Continue with 42
        </a>
      </div>
    </div>
  );
}
