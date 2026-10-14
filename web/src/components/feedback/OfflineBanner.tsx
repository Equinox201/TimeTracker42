import { useEffect, useState } from "react";

import { Banner } from "../ui/Banner";

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

  return <Banner tone="warn">You are offline. Showing last available data where possible.</Banner>;
}
