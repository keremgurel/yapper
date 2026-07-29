"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The desktop app is Studio-only: it must never render a marketing page. If the
 * webview ever lands on a non-Studio route (the homepage, a blog post, a stray
 * redirect after auth), bounce it straight into the app. No-op on the web, where
 * the same routes are the actual website.
 */
export default function AppRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isDesktop = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
    if (!isDesktop) return;
    // Allow only the app surfaces (/studio/…). Everything else is website.
    if (!pathname.startsWith("/studio/")) {
      router.replace("/studio/home");
    }
  }, [pathname, router]);

  return null;
}
