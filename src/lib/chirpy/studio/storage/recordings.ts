import { and, eq } from "drizzle-orm";
import type { StorageDeleteRecordingInput } from "../../../../../protocol/app-actions.generated";
import { getDb } from "@/lib/db/client";
import { submissions } from "@/lib/db/schema";
import { formatStorageBytes } from "@/lib/storage/format";
import { deleteSubmission } from "@/lib/submissions/operations/delete-submission";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";

async function recordingTitle(userId: string, id: string) {
  const [row] = await getDb()
    .select({ title: submissions.title })
    .from(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, userId)))
    .limit(1);
  return row ? row.title?.trim() || "Untitled recording" : null;
}

/** Runs only after the creator confirms, through the history page's
 * delete. */
export const deleteRecordingAction: StudioActionDefinition<StorageDeleteRecordingInput> =
  {
    async run({ recordingID }, { userId }) {
      const title = await recordingTitle(userId, recordingID);
      const removed = title
        ? await deleteSubmission(userId, recordingID)
        : null;
      if (!removed?.ok)
        throw new StudioActionFailure(
          "not_found",
          "That recording was already gone, so nothing was deleted.",
        );
      return {
        summary: `Deleted the “${title}” recording with its transcript and feedback.`,
        effects: ["storage", "ideas"],
      };
    },
    describe({ recordingID }, names) {
      const title = names.recordings?.[recordingID];
      const bytes = Number(names.sizes?.[recordingID] ?? 0);
      const size =
        bytes > 0 ? `, freeing up to ${formatStorageBytes(bytes)}` : "";
      return title
        ? `Delete the “${title}” recording with its transcript and feedback${size}`
        : "Delete that recording with its transcript and feedback";
    },
  };
