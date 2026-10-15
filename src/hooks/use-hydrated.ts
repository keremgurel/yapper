"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while React hydrates and on the server, true after. Anything that
 * depends on the browser (the saved theme, the window) renders the server's
 * value first and switches after hydration, so the HTML matches and React
 * actually applies the change instead of warning and leaving the server's.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
