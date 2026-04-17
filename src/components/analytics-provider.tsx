"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";

/**
 * Tracks SPA page-views on route changes.
 * PostHog is initialized via instrumentation-client.ts (Next.js 15.3+).
 */
export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPath = useRef<string | null>(null);

  /* Track page views on route change */
  useEffect(() => {
    const url = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    // Avoid double-firing on initial load
    if (prevPath.current !== url) {
      trackPageView(window.location.origin + url);
      prevPath.current = url;
    }
  }, [pathname, searchParams]);

  return null;
}
