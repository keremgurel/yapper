import type { Idea } from "@/lib/ideas/types";

/**
 * Read-only access to the retired localStorage Idea Bank.
 *
 * The bank now lives in Postgres. This exists solely so a browser that still
 * holds the old data can hand it over once, and it is deliberately read-plus-
 * clear: nothing writes ideas here any more.
 */
const IDEAS_KEY = "yapper-idea-bank-v1";

/** Set once the browser's ideas have been accepted by the server, so the
 * migration never runs twice even if the key is somehow repopulated. */
const MIGRATED_KEY = "yapper-idea-bank-migrated-v1";

export function loadLegacyIdeas(): Idea[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IDEAS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Idea[]) : [];
  } catch {
    return [];
  }
}

export function legacyMigrationDone(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MIGRATED_KEY) === "1";
}

/**
 * Mark the handover complete. The old ideas are deliberately NOT deleted: the
 * server copy is authoritative from here, but leaving the originals in place
 * costs nothing and means a failed or partial migration is still recoverable.
 */
export function markLegacyMigrationDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    // Storage unavailable. The server dedupes on (userId, sourceClientId), so
    // a repeated migration is a no-op rather than a duplication.
  }
}
