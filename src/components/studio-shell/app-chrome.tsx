"use client";

import { startTransition, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";

import { clearClientResources } from "@/lib/client-resource-cache";

const NATIVE_ROUTES = [
  "/studio/home",
  "/studio/brain",
  "/studio/ideas",
  "/studio/library",
  "/studio/recorder",
  "/studio/poster",
  "/studio/calendar",
  "/studio/automations",
  "/studio/dictionary",
  "/studio/connections",
] as const;

type NativeNavigationWindow = Window & {
  __yapperNativeNavigate?: (path: string) => boolean;
  __yapperNativeSignOut?: () => boolean;
  __yapperNativeManageAccount?: () => boolean;
  webkit?: {
    messageHandlers?: {
      yapperNative?: { postMessage: (body: unknown) => void };
    };
  };
};

let activeCacheOwner: string | null | undefined;

/**
 * Marks the document as running inside the native desktop shell (Tauri) so the
 * app can shed its marketing/website chrome and adopt native window affordances
 * (no site navbar, room for the inset traffic lights, translucent surfaces over
 * the native vibrancy material). On the web this renders nothing and sets
 * nothing, so the browser experience is untouched.
 */
export default function AppChrome() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, user } = useUser();
  const { signOut, openUserProfile } = useClerk();

  // Tell the native shell which route is actually on screen.
  //
  // It asks for a tab and then has no way of knowing when React has committed
  // it, so it used to reveal the web view immediately: clicking Brain showed
  // the previous page under the Brain heading for a beat. This effect runs
  // after the new route paints, which is exactly the moment the shell can stop
  // covering it.
  useEffect(() => {
    const bridge = (window as NativeNavigationWindow).webkit?.messageHandlers
      ?.yapperNative;
    bridge?.postMessage({
      command: "route_changed",
      args: { path: pathname },
    });
  }, [pathname]);

  useEffect(() => {
    if (!isLoaded) return;
    const nextOwner = user?.id ?? null;
    if (activeCacheOwner !== undefined && activeCacheOwner !== nextOwner) {
      clearClientResources();
    }
    activeCacheOwner = nextOwner;
  }, [isLoaded, user?.id]);

  useEffect(() => {
    const isDesktop = "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
    if (isDesktop) {
      document.documentElement.setAttribute("data-app", "");

      // The native sidebar lives outside React. Hand it the App Router instead
      // of making WKWebView perform a full document load for every tab. A full
      // load discarded every mounted route and every in-memory data cache,
      // which is why returning to Calendar or Idea Bank always looked cold.
      const nativeWindow = window as NativeNavigationWindow;
      nativeWindow.__yapperNativeNavigate = (path) => {
        if (!path.startsWith("/studio/")) return false;
        startTransition(() => router.push(path, { scroll: false }));
        return true;
      };

      // The account lives with Clerk, in this web session, so the native badge
      // cannot sign anyone out on its own: clearing cookies would leave the
      // session alive on the server and log the creator out of nothing. These
      // hand the two account actions to Clerk, where they belong.
      nativeWindow.__yapperNativeSignOut = () => {
        void signOut({ redirectUrl: "/studio/home" });
        return true;
      };
      nativeWindow.__yapperNativeManageAccount = () => {
        openUserProfile();
        return true;
      };

      // Warm every lightweight dashboard route after the first page becomes
      // interactive. Next deduplicates these and keeps the route payloads in
      // its client cache, so the native sidebar can switch immediately.
      const warmRoutes = () => {
        for (const route of NATIVE_ROUTES) router.prefetch(route);
      };
      const idleWindow = window as Window & {
        requestIdleCallback?: (callback: () => void) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      const idleID = idleWindow.requestIdleCallback?.(warmRoutes);
      const timeoutID =
        idleID === undefined ? window.setTimeout(warmRoutes, 500) : undefined;

      return () => {
        delete nativeWindow.__yapperNativeNavigate;
        delete nativeWindow.__yapperNativeSignOut;
        delete nativeWindow.__yapperNativeManageAccount;
        if (idleID !== undefined) idleWindow.cancelIdleCallback?.(idleID);
        if (timeoutID !== undefined) window.clearTimeout(timeoutID);
      };
    }
  }, [router, signOut, openUserProfile]);

  return null;
}
