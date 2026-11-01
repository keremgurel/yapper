import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { deleteContentItem, getContentItem } from "@/lib/db/content";
import { releasePostedMedia } from "@/lib/db/posted-media-retention";
import { drainR2AfterResponse } from "@/lib/db/r2-drain";
import { submissions } from "@/lib/db/schema";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

export const POSTER_UPLOAD_SOURCE = "yapper://poster-upload";

/**
 * Remove a waiting Poster upload and release its stored file, never a project
 * or a platform post. Poster's remove button (through
 * DELETE /api/publish/uploads/[id]) and Chirpy share it.
 */
export async function removePosterUpload(
  userId: string,
  id: string,
): Promise<OperationResult<{ title: string }>> {
  const item = await getContentItem(userId, id);
  if (!item || item.sourceUrl !== POSTER_UPLOAD_SOURCE)
    return refused(404, "not_found");
  if (item.submissionId) {
    const [submission] = await getDb()
      .select({ mediaKey: submissions.mediaKey })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, item.submissionId),
          eq(submissions.userId, userId),
        ),
      )
      .limit(1);
    if (submission?.mediaKey) {
      const result = await releasePostedMedia(
        { userId, mediaKey: submission.mediaKey },
        "user_requested",
      );
      if (result !== "released")
        return refused(
          409,
          "video_in_use",
          "This video is still needed for publishing or a scheduled post. Try again when it finishes.",
        );
    }
  }
  await deleteContentItem(userId, id);
  drainR2AfterResponse();
  return succeeded({ title: item.title });
}
