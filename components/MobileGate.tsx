"use client";

import { MobileApp } from "@/components/mobile/MobileApp";
import { useEffect, useState } from "react";

/**
 * Renders the mobile app shell on viewports < 640px.
 * Renders children (desktop) otherwise.
 * Uses CSS initially to avoid layout flash, then locks in once mounted.
 */
export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Before hydration: let CSS handle it (no flash)
  if (isMobile === null) {
    return (
      <>
        <span className="mobile-gate-mobile">
          <MobileApp />
        </span>
        <span className="mobile-gate-desktop">{children}</span>
      </>
    );
  }

  if (isMobile) return <MobileApp />;
  return <>{children}</>;
}
