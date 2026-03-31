import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { PublicOnly, RequireAuth } from "./RequireAuth";

const AppShell = lazy(async () => ({
  default: (await import("../components/shell/AppShell")).AppShell
}));

const AuthCallbackPage = lazy(async () => ({
  default: (await import("../pages/AuthCallbackPage")).AuthCallbackPage
}));

const LoginPage = lazy(async () => ({
  default: (await import("../pages/LoginPage")).LoginPage
}));

const MainPage = lazy(async () => ({
  default: (await import("../pages/MainPage")).MainPage
}));

const HistoryPage = lazy(async () => ({
  default: (await import("../pages/HistoryPage")).HistoryPage
}));

const SettingsPage = lazy(async () => ({
  default: (await import("../pages/SettingsPage")).SettingsPage
}));

function RouteLoading() {
  return (
    <div className="min-h-screen bg-tt42-bg px-4 pt-16 text-center text-sm text-tt42-muted">
      Loading...
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="main" replace />} />
            <Route path="main" element={<MainPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/app/main" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
