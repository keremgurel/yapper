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
  const isDesktop = useSyncExternalStore(
    () => () => undefined,
    () =>
      process.env.NODE_ENV === "development" ||
      "__TAURI_INTERNALS__" in window ||
      "__TAURI__" in window,
    () => process.env.NODE_ENV === "development",
  );
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isDesktop) {
      router.replace("/");
      return;
    }
    if (pathname === "/studio") router.replace("/studio/home");
  }, [isDesktop, pathname, router]);

  return isDesktop ? children : null;
}
