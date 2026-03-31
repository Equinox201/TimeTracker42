import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => window.navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);

    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-400/45 bg-amber-400/15 px-3 py-2 text-sm text-tt42-text">
      You are offline. Showing last available data where possible.
    </div>
  );
}
