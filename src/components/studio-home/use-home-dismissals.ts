"use client";
import { useCallback, useSyncExternalStore } from "react";
import type { VideoGroup } from "./content-opportunities";
const EVENT = "home-suggestions-changed";
const fallback = new Map<string, string>();
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function read(key: string): string {
  if (fallback.has(key)) return fallback.get(key)!;
  try {
    return localStorage.getItem(key) ?? "{}";
  } catch {
    return fallback.get(key) ?? "{}";
  }
}
export function activeDismissals(
  raw: string,
  now: number,
): Record<string, number> {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([, until]) =>
            typeof until === "number" && Number.isFinite(until) && until > now,
        )
        .slice(-400),
    );
  } catch {
    return {};
  }
}
/** Account-scoped, device-local preferences. Hide all platform copies of a
 * suggestion for seven days; Recent and Top remain available. */
export function useHomeDismissals(userId: string, now: number) {
  const key = `yapper:home-hidden:v1:${userId}`;
  const snapshot = useSyncExternalStore(
    subscribe,
    useCallback(() => read(key), [key]),
    () => "{}",
  );
  const hidden = activeDismissals(snapshot, now);
  const write = (value: Record<string, number>) => {
    const serialized = JSON.stringify(value);
    try {
      localStorage.setItem(key, serialized);
      fallback.delete(key);
    } catch {
      fallback.set(key, serialized);
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return {
    hidden,
    dismiss: (group: VideoGroup) =>
      write({
        ...activeDismissals(read(key), now),
        ...Object.fromEntries(
          group.posts.map((post) => [
            `${post.platform}:${post.id}`,
            now + 7 * 86_400_000,
          ]),
        ),
      }),
    reset: () => write({}),
  };
}
