import { exitDemoMode, isDemoMode } from "../../demo/demoMode";

export function DemoBanner() {
  if (!isDemoMode()) {
    return null;
  }

  const exitDemo = () => {
    exitDemoMode();
    window.location.assign("/login");
  };

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tt42-teal/40 bg-tt42-teal/10 px-3 py-2 text-sm text-tt42-text">
      <span>
        <strong className="font-semibold">Demo mode.</strong> Sample data for John Doe; changes reset
        on reload.
      </span>
      <button
        type="button"
        onClick={exitDemo}
        className="rounded-lg border border-tt42-border bg-tt42-surface2 px-3 py-1 text-xs font-medium"
      >
        Exit demo
      </button>
    </div>
  );
}
