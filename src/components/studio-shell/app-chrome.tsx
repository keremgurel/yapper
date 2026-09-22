"use client";

import { startTransition, useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { PrefetchOptions } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { clearClientResources } from "@/lib/client-resource-cache";
import { warmStudioData } from "@/lib/studio/warm-studio";

const NATIVE_ROUTES = [
  "/studio/home",
  "/studio/brain",
  "/studio/ideas",
  "/studio/library",
  "/studio/recorder",
  "/studio/poster",
  "/studio/calendar",
  "/studio/automations",
  "/studio/brand",
  "/studio/storage",
  "/studio/dictionary",
  "/studio/connections",
] as const;

/** A full prefetch: the whole route payload, not just the part above the
 * first loading boundary. Studio routes are dynamic and have no loading
 * boundary, so the default prefetch fetched nothing and every tab switch
 * waited on the server. The enum value is written as its string so this
 * client module does not import from Next's internals. */
const FULL_PREFETCH = "full" as PrefetchOptions["kind"];

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
  const { isLoaded, user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const userId = user?.id ?? null;
  const displayName = user?.fullName || user?.firstName || null;
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  // Tell the native shell who is signed in.
  //
  // It used to work this out from cookies, which is a guess: Clerk's cookies
  // are split across the app and its own domain and the shape is theirs to
  // change, and one wrong guess hid the entire sidebar from somebody who was
  // signed in. Clerk itself knows, and this is where it can say so.
  useEffect(() => {
    if (!isLoaded) return;
    const bridge = (window as NativeNavigationWindow).webkit?.messageHandlers
      ?.yapperNative;
    bridge?.postMessage({
      command: "auth_state",
      args: { signedIn: !!userId, userId, displayName, email },
    });
  }, [isLoaded, userId, displayName, email]);

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

      // Warm every dashboard route, and the data the busiest ones read,
      // after the first page becomes interactive. Next keeps full prefetches
      // for its static period and re-fetches one when it goes stale, so the
      // native sidebar switches from memory for the whole session.
      const warmRoute = (route: string): void =>
        router.prefetch(route, {
          kind: FULL_PREFETCH,
          onInvalidate: () => warmRoute(route),
        });
      const warmRoutes = () => {
        for (const route of NATIVE_ROUTES) warmRoute(route);
        warmStudioData();
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
