import { and, eq } from "drizzle-orm";
import { parseContentInput } from "@/lib/content/input";
import {
  ownPillarIdByName,
  resolveOwnPillar,
} from "@/lib/content/pillar-ownership";
import { getDb } from "@/lib/db/client";
import { updateContentItem, type ContentItemInput } from "@/lib/db/content";
import { submissions } from "@/lib/db/schema";
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
}

/**
 * Partial update of one of the creator's items: workbench autosave, status,
 * pillar and date changes, and the recording link. PATCH /api/content/[id]
 * and Chirpy's idea edits share it, so both apply the same ownership checks.
 * - submissionId must be the caller's own submission (or null to unlink).
 * - pillarId must be the caller's own pillar (or null to clear it).
 */
export async function updateOwnContentItem(
  userId: string,
  id: string,
  body: Record<string, unknown>,
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

  const item = await updateContentItem(userId, id, input);
  if (!item) return refused(404, "not_found");
  return succeeded({ item, enrichRecording: changesRecording(input) });
}

function changesRecording(input: ContentItemInput): boolean {
  return (
    input.recordedTranscript !== undefined ||
    input.submissionId !== undefined ||
    input.status === "posted"
  );
}
