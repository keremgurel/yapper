import { after } from "next/server";

import { processR2LifecycleBatch } from "@/lib/db/r2-lifecycle";

/**
 * Drain the R2 deletion queue as soon as the response has been sent.
 *
 * Deleting an object cannot happen inside the transaction that releases it:
 * a rollback after the R2 call would leave a row pointing at a file that no
 * longer exists, and a crash after the commit would leave a file nothing
 * points at. So the transaction enqueues, and a worker with a lease does the
 * physical delete and retries until R2 confirms.
 *
 * Nothing about that requires waiting for a timer, though. `after` runs once
 * the caller already has their response, so the common case now deletes within
 * seconds of the request that released it, and the scheduled sweep goes back
 * to being what it should be: a backstop for the leftovers, the crashed
 * leases, the R2 outages, and the deletes deferred behind a live publish.
 *
 * Deliberately small and time-boxed. This is a courtesy pass riding on
 * somebody else's request, not the batch worker.
 */
const DRAIN_LIMIT = 5;
const DRAIN_BUDGET_MS = 10_000;

export function drainR2AfterResponse(limit: number = DRAIN_LIMIT): void {
  try {
    after(async () => {
      try {
        await processR2LifecycleBatch({
          limit,
          deadlineAt: Date.now() + DRAIN_BUDGET_MS,
        });
      } catch {
        // The caller's delete already committed and the sweep will retry, so a
        // failed opportunistic drain must never become their problem.
      }
    });
  } catch {
    // `after` throws when there is no request scope, which is every direct
    // call to a route handler from a test or a script. Scheduling the courtesy
    // pass is itself best effort: the deletion is already durably enqueued and
    // the sweep owns the guarantee.
  }
}
