import { exitDemoMode, isDemoMode } from "../../demo/demoMode";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";

export function DemoBanner() {
  if (!isDemoMode()) {
    return null;
  }

  const exitDemo = () => {
    exitDemoMode();
    window.location.assign("/login");
  };

  return (
    <Banner tone="success">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong className="font-semibold">Demo mode.</strong>{" "}
          <span className="text-tt42-muted">Sample data for John Doe; changes reset on reload.</span>
        </span>
        <Button variant="secondary" size="sm" onClick={exitDemo}>
          Exit demo
        </Button>
      </div>
    </Banner>
  );
}
