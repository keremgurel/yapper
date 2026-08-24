"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type NativeBridgeWindow = Window & {
  webkit?: {
    messageHandlers?: {
      yapperNative?: { postMessage: (body: unknown) => void };
    };
  };
};

/**
 * Tells the macOS shell that the destination route has replaced the previous
 * page. This intentionally lives below the dashboard template instead of in
 * the persistent layout: Next can update a layout's pathname while retaining
 * its old page during a slow navigation, but the keyed template only commits
 * with the destination screen (or its loading UI).
 */
export default function NativeRouteCommit() {
  const pathname = usePathname();

  useEffect(() => {
    const bridge = (window as NativeBridgeWindow).webkit?.messageHandlers
      ?.yapperNative;
    bridge?.postMessage({
      command: "route_changed",
      args: { path: pathname },
    });
  }, [pathname]);

  return null;
}
