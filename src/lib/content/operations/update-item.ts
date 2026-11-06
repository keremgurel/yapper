import { and, eq } from "drizzle-orm";
import { parseContentInput } from "@/lib/content/input";
import {
  ownPillarIdByName,
  resolveOwnPillar,
} from "@/lib/content/pillar-ownership";
import { parseContentBase, rebaseOnto } from "@/lib/content/rebase";
import { getDb } from "@/lib/db/client";
import { ContentConflict } from "@/lib/db/content-conflict";
import { updateContentItem, type ContentItemInput } from "@/lib/db/content";
import { contentItems, submissions } from "@/lib/db/schema";
import { parseIdeaFields } from "@/lib/ideas/input";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

type ContentRow = NonNullable<Awaited<ReturnType<typeof updateContentItem>>>;

export interface UpdatedItem {
  item: ContentRow;
  /** The saved recording changed, so its memory should be rebuilt after the
   * reply (the caller schedules it, since only it has the request). */
  enrichRecording: boolean;
  /** The save was merged with a change made since the client read the row;
   * the client should show the saved fields. */
  rebased: boolean;
}

/** Sees the locked row and returns what to write, or throws
 * ContentConflict. */
export type ItemReconcile = (
  current: typeof contentItems.$inferSelect,
  input: ContentItemInput,
) => ContentItemInput;

/**
 * Partial update of one of the creator's items: workbench autosave, status,
 * pillar and date changes, and the recording link. PATCH /api/content/[id]
 * and Chirpy's idea edits share it, so both apply the same ownership checks.
 * - submissionId must be the caller's own submission (or null to unlink).
 * - pillarId must be the caller's own pillar (or null to clear it).
 * - With `base` (what the client last read of the fields it sends), the
 *   save is merged into the row as stored now; without it, as before, the
 *   newest write wins. `reconcile` lets a server caller check the row itself.
 */
export async function updateOwnContentItem(
  userId: string,
  id: string,
  body: Record<string, unknown>,
  reconcile?: ItemReconcile,
): Promise<OperationResult<UpdatedItem>> {
  const { input, badStatus } = parseContentInput(body);
  if (badStatus) return refused(400, "bad_status");
  // The idea-specific half: verbatim words, the resolved reference, and the
  // flexible body. Both surfaces write through this one path.
  Object.assign(input, parseIdeaFields(body));

  // Linking a recording: verify the submission is the caller's own. (The FK
  // only proves existence; without this a user could link someone else's.)
  if (body.submissionId !== undefined) {
    if (body.submissionId === null) input.submissionId = null;
    else if (typeof body.submissionId === "string") {
      const [own] = await getDb()
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.id, body.submissionId),
            eq(submissions.userId, userId),
          ),
        )
        .limit(1);
      if (!own) return refused(400, "bad_submission");
      input.submissionId = own.id;
    }
  }

  // Filing under a pillar: same reasoning as the submission check above. The
  // legacy free-text pillar is cleared with it, so the read fallback cannot
  // shadow the link the creator just chose.
  if (body.pillarId !== undefined) {
    const owned = await resolveOwnPillar(userId, body.pillarId);
    if (!owned.ok) return refused(400, "bad_pillar");
    input.pillarId = owned.pillarId;
    input.pillar = null;
  }
  // A pillar sent by name (a drafted idea's classification) is linked to the
  // creator's pillar of that name, so it groups with the rest of that pillar.
  // The name stays too: reads prefer the linked pillar, and the response
  // still says what the item was filed under.
  else if (typeof input.pillar === "string" && input.pillar) {
    input.pillarId = await ownPillarIdByName(userId, input.pillar);
  }

  const base = parseContentBase(body.base);
  let rebased = false;
  let item;
  try {
    item = await updateContentItem(userId, id, input, (current) => {
      if (reconcile) return reconcile(current, input);
      if (!base) return input;
      const merged = rebaseOnto(input, base, current);
      rebased = merged.rebased;
      return merged.patch;
    });
  } catch (error) {
    if (error instanceof ContentConflict) return refused(409, "conflict");
    throw error;
  }
  if (!item) return refused(404, "not_found");
  return succeeded({
    item,
    enrichRecording: changesRecording(input),
    rebased,
  });
}

function changesRecording(input: ContentItemInput): boolean {
  return (
    input.recordedTranscript !== undefined ||
    input.submissionId !== undefined ||
    input.status === "posted"
  );
}
