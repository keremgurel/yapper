import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { deleteContentItem, getContentItem } from "@/lib/db/content";
import { submissions } from "@/lib/db/schema";
import { releasePostedMedia } from "@/lib/db/posted-media-retention";
import { drainR2AfterResponse } from "@/lib/db/r2-drain";

export const runtime = "nodejs";

/** Remove a waiting Poster upload, never a project or a platform post. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await getContentItem(userId, id);
  if (!item || item.sourceUrl !== "yapper://poster-upload")
    return Response.json({ error: "not_found" }, { status: 404 });
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
        return Response.json(
          {
            error: "video_in_use",
            message:
              "This video is still needed for publishing or a scheduled post. Try again when it finishes.",
          },
          { status: 409 },
        );
    }
  }
  await deleteContentItem(userId, id);
  drainR2AfterResponse();
  return Response.json({ ok: true });
}
