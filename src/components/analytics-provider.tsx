"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { posthog, track } from "@/lib/analytics";
import { clientContext, pageName } from "@/lib/analytics/context";

/** Identity and route tracking have one owner across marketing and Studio. */
export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isLoaded, user } = useUser();
  const previousUser = useRef<string | null | undefined>(undefined);
  const previousPage = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const id = user?.id ?? null;
    if (previousUser.current !== id) {
      // Includes reload after signing out elsewhere and direct account switches.
      if (posthog.get_property("$user_id") && posthog.get_distinct_id() !== id)
        posthog.reset();
      posthog.register({
        ...clientContext(navigator.userAgent),
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      });
      if (id) {
        posthog.identify(id);
        track("account_signed_in");
      }
      previousUser.current = id;
    }
  }, [isLoaded, user?.id]);

  useEffect(() => {
    // The Mac's parked Clerk webview is not a real visit or a visible screen.
    if (clientContext(navigator.userAgent).surface === "macos") return;
    const page = pageName(pathname);
    if (previousPage.current === page) return;
    previousPage.current = page;
    const safe = new URL(page, window.location.origin);
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ]) {
      const value = searchParams.get(key);
      if (value) safe.searchParams.set(key, value.slice(0, 200));
    }
    track("$pageview", { $current_url: safe.href, $pathname: page });
    if (pathname.startsWith("/studio/"))
      track("studio_screen_viewed", { screen: page });
  }, [pathname, searchParams]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const anchor = (
        event.target instanceof Element ? event.target : null
      )?.closest("a");
      if (!anchor) return;
      const url = new URL(anchor.href, window.location.origin);
      if (
        url.hostname === "github.com" &&
        url.pathname.startsWith("/keremgurel/yapper/releases")
      ) {
        track(
          url.pathname.includes("/download/")
            ? "app_download_clicked"
            : "app_release_page_opened",
          { platform: "macos", source_page: pageName(pathname) },
        );
      } else if (url.protocol === "yapper-studio:") {
        track("desktop_handoff_requested", { source_page: pageName(pathname) });
      } else if (
        url.origin === window.location.origin &&
        ["/sign-up", "/studio/home"].includes(url.pathname)
      ) {
        track("studio_entry_clicked", {
          source_page: pageName(pathname),
          destination: url.pathname,
        });
      }
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [pathname]);
  return null;
}
