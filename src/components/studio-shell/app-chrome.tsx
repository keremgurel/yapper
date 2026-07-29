"use client";

import { useEffect } from "react";

/**
 * Marks the document as running inside the native desktop shell (Tauri) so the
 * app can shed its marketing/website chrome and adopt native window affordances
 * (no site navbar, room for the inset traffic lights, translucent surfaces over
 * the native vibrancy material). On the web this renders nothing and sets
 * nothing, so the browser experience is untouched.
 */
export default function AppChrome() {
  useEffect(() => {
    const isDesktop = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
    if (isDesktop) {
      document.documentElement.setAttribute("data-app", "");
    }
    return () => {
      // Leave the attribute in place for the session; nothing to clean up.
    };
  }, []);

  return null;
}
