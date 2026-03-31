import { Outlet } from "react-router-dom";

import { TabBar } from "../nav/TabBar";
import { OfflineBanner } from "../feedback/OfflineBanner";

export function AppShell() {
  return (
    <div className="min-h-screen bg-tt42-bg text-tt42-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 pb-[calc(80px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))] md:max-w-5xl md:px-8 md:pb-8">
        <header className="sticky top-0 z-30 mb-4 rounded-card border border-tt42-border bg-tt42-surface/90 p-4 shadow-soft backdrop-blur md:mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-tt42-muted">TimeTracker42</p>
              <h1 className="text-lg font-semibold">Attendance Dashboard</h1>
            </div>
            <span className="rounded-full border border-tt42-border px-3 py-1 text-xs text-tt42-muted">
              Web MVP
            </span>
          </div>

          <OfflineBanner />
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <TabBar />
    </div>
  );
}
