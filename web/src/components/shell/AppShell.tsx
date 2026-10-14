import { Outlet } from "react-router-dom";

import { DemoBanner } from "../feedback/DemoBanner";
import { OfflineBanner } from "../feedback/OfflineBanner";
import { SideNav } from "../nav/SideNav";
import { TabBar } from "../nav/TabBar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-tt42-bg text-tt42-text md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <SideNav />

      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))] md:max-w-5xl md:px-10 md:pb-12 md:pt-8">
        <header className="mb-5 flex items-center gap-2.5 md:hidden">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-tt42-accent text-[13px] font-bold tracking-tight text-tt42-on-accent"
          >
            42
          </span>
          <span className="text-base font-semibold tracking-tight">TimeTracker</span>
        </header>

        <div className="mb-4 space-y-2 empty:hidden">
          <DemoBanner />
          <OfflineBanner />
        </div>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <TabBar />
    </div>
  );
}
