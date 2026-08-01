"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Studio is the installed desktop product, not a public web app. The deployed
 * route remains available to the Tauri webview, while normal browsers return
 * to the marketing site before any product UI is shown.
 */
export default function StudioRouteBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const environment = useSyncExternalStore<"pending" | "desktop" | "browser">(
    (onStoreChange) => {
      // Hydration starts from the server's conservative `pending` snapshot.
      // Request one client snapshot immediately after mount; the desktop
      // identity itself stays stable for the life of this document.
      queueMicrotask(onStoreChange);
      return () => undefined;
    },
    () =>
      process.env.NODE_ENV === "development" ||
      navigator.userAgent.includes("YapperStudioNative/") ||
      "__TAURI_INTERNALS__" in window ||
      "__TAURI__" in window
        ? "desktop"
        : "browser",
    () => "pending",
  );
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (environment === "pending") return;
    if (environment === "browser") {
      router.replace("/");
      return;
    }
    if (pathname === "/studio") router.replace("/studio/home");
  }, [environment, pathname, router]);

  return environment === "desktop" ? children : null;
}
