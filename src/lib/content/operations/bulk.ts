import {
  deleteContentItems,
  setContentStage,
  updateContentItem,
} from "@/lib/db/content";
import { contentStages, contentStatuses } from "@/lib/db/schema";
import { resolveOwnPillar } from "@/lib/content/pillar-ownership";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

/** One bulk call may not touch an unbounded number of rows. */
export const BULK_MAX_IDS = 200;

function ids(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .slice(0, BULK_MAX_IDS)
    : [];
}

/**
 * Bulk actions for the shared item table: move items between the bank and the
 * library, reclassify them, set their status, or delete them. Every query is
 * scoped to the caller, so an id the creator does not own simply matches
 * nothing. The table's selection bar and Chirpy both call this.
 *
 * Moving is a stage flip and nothing else. That is the whole reason the two
 * surfaces share a table: sending an idea to the library must not transform it.
 * Returns how many items changed.
 */
export async function bulkUpdateContent(
  userId: string,
  body: Record<string, unknown>,
): Promise<OperationResult<number>> {
  const targets = ids(body.ids);
  if (!targets.length) return refused(400, "no_ids");

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "stage") {
    const stage = body.stage;
    if (!(contentStages as readonly string[]).includes(stage as string)) {
      return refused(400, "bad_stage");
    }
    return succeeded(
      await setContentStage(
        userId,
        targets,
        stage as (typeof contentStages)[number],
      ),
    );
  }

  if (action === "delete") {
    return succeeded(await deleteContentItems(userId, targets));
  }

  if (action === "pillar") {
    // A null pillarId clears the classification, which is a legitimate edit.
    const owned = await resolveOwnPillar(userId, body.pillarId ?? null);
    if (!owned.ok) return refused(400, "bad_pillar");
    let updated = 0;
    for (const id of targets) {
      // The legacy free-text pillar is cleared alongside the link. It is the
      // read fallback for rows that predate `project_pillars`, so leaving it
      // behind would let a stale name outlive the reclassify that replaced it.
      const row = await updateContentItem(userId, id, {
        pillarId: owned.pillarId,
        pillar: null,
      });
      if (row) updated += 1;
    }
    return succeeded(updated);
  }

  if (action === "status") {
    const status = body.status;
    if (!(contentStatuses as readonly string[]).includes(status as string)) {
      return refused(400, "bad_status");
    }
    // `scheduled` requires a date, which a bulk action has no sensible value
    // for; the DB CHECK would reject it anyway, so refuse it up front.
    if (status === "scheduled") return refused(400, "status_needs_date");
    let updated = 0;
    for (const id of targets) {
      const row = await updateContentItem(userId, id, {
        status: status as (typeof contentStatuses)[number],
      });
      if (row) updated += 1;
    }
    return succeeded(updated);
  }

  return refused(400, "bad_action");
}
