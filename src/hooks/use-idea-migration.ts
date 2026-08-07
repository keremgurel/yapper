"use client";

import { useEffect, useState } from "react";
import { IMPORT_MAX } from "@/lib/content/input";
import {
  legacyMigrationDone,
  loadLegacyIdeas,
  markLegacyMigrationDone,
} from "@/lib/ideas/legacy-store";

/** Matches the route's per-call cap, so no batch is rejected as too large. */
const MIGRATE_BATCH = IMPORT_MAX;

/**
 * Hand this browser's localStorage ideas to the server, once.
 *
 * Runs before the bank renders so a returning creator never sees an empty page
 * where their ideas used to be. Idempotent on both sides: a local flag stops
 * repeat attempts, and the server dedupes on the original localStorage id, so
 * even a lost flag cannot duplicate anything.
 *
 * Returns whether a migration is in flight, so the caller can wait for it
 * rather than fetching a list that is about to change.
 */
export function useIdeaMigration(enabled: boolean): { migrating: boolean } {
  const [migrating, setMigrating] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const run = async () => {
      if (legacyMigrationDone()) return;
      const ideas = loadLegacyIdeas();
      if (!ideas.length) {
        markLegacyMigrationDone();
        return;
      }
      try {
        // Sent in batches because the route caps one call at IMPORT_MAX. A
        // single truncated call would strand every idea past the cap: the flag
        // below would be set, and nothing would ever try again.
        for (let i = 0; i < ideas.length; i += MIGRATE_BATCH) {
          const res = await fetch("/api/ideas/migrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ideas: ideas.slice(i, i + MIGRATE_BATCH) }),
          });
          // Only flag success on a confirmed accept; a failed call must retry
          // on the next visit rather than silently stranding the creator's
          // ideas. Batches already accepted dedupe on the retry.
          if (!res.ok) return;
        }
        markLegacyMigrationDone();
      } catch {
        // Same: leave the flag unset so the next visit tries again.
      }
    };

    void run().finally(() => {
      if (active) setMigrating(false);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { migrating: enabled && migrating === null };
}
