import { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { Card } from "../components/ui/Card";

function AuthBootScreen() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center px-4 py-10">
      <Card as="div" padding="none" className="w-full p-6">
        <h1 className="text-xl font-semibold">Checking session…</h1>
        <p className="mt-2 text-sm text-tt42-muted">Please wait.</p>
      </Card>
    </div>
  );
}

export function RequireAuth({ children }: PropsWithChildren) {
  const { status, isAuthenticated } = useAuth();

  if (status === "booting") {
    return <AuthBootScreen />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: PropsWithChildren) {
  const { status, isAuthenticated } = useAuth();
  if (status === "booting") {
    return <AuthBootScreen />;
  }
  if (isAuthenticated) {
    return <Navigate to="/app/main" replace />;
  }
  return <>{children}</>;
}
