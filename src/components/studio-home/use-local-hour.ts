"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/** The creator's local hour, or null during server rendering, where the
 * server's clock would greet them for the wrong time of day. */
export function useLocalHour(): number | null {
  return useSyncExternalStore(
    noSubscription,
    () => new Date().getHours(),
    () => null,
  );
}
