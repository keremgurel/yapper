import { recordingScriptPatch } from "@/lib/content/recording-script";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "./client";
import {
  contentItems,
  publishJobs,
  publishingSchedules,
  r2Objects,
  submissions,
} from "./schema";
import {
  lockStorageUserWithinTx,
  lockMediaReferenceWithinTx,
} from "./storage-accounting";

export interface EditorMaster {
  projectId: string;
  submissionId: string;
  revision: string;
  editedAt: Date;
  title: string;
  transcript: string;
}

/** One current master per project; retain revisions already sent for publication. */
export async function saveEditorMaster(userId: string, input: EditorMaster) {
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    const [source] = await tx
      .select({ key: submissions.mediaKey })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, input.submissionId),
          eq(submissions.userId, userId),
        ),
      )
      .limit(1);
    if (!source?.key) throw new Error("bad_submission");
    await lockMediaReferenceWithinTx(tx, userId, source.key);
    const [object] = await tx
      .select({ key: r2Objects.mediaKey })
      .from(r2Objects)
      .where(
        and(
          eq(r2Objects.mediaKey, source.key),
          eq(r2Objects.userId, userId),
          eq(r2Objects.state, "active"),
        ),
      )
      .limit(1);
    if (!object) throw new Error("media_unavailable");
    const identity = `native-project:${input.projectId}`;
    const [existing] = await tx
      .select()
      .from(contentItems)
      .where(
        and(
          eq(contentItems.userId, userId),
          eq(contentItems.sourceClientId, identity),
        ),
      )
      .for("update")
      .limit(1);
    let previous: typeof existing | undefined = existing;
    if (previous?.editorUpdatedAt && previous.editorUpdatedAt > input.editedAt)
      throw new Error("newer_edit_available");
    if (
      previous?.editorRevision === input.revision &&
      previous.submissionId === input.submissionId &&
      previous.title === input.title
    )
      return previous;
    if (previous && previous.editorRevision !== input.revision) {
      const [publication] = await tx
        .select({ id: publishJobs.id })
        .from(publishJobs)
        .where(
          and(
            eq(publishJobs.userId, userId),
            eq(publishJobs.contentItemId, previous.id),
            ne(publishJobs.status, "failed"),
          ),
        )
        .limit(1);
      const [schedule] = await tx
        .select({ id: publishingSchedules.id })
        .from(publishingSchedules)
        .where(
          and(
            eq(publishingSchedules.userId, userId),
            eq(publishingSchedules.contentItemId, previous.id),
            inArray(publishingSchedules.status, [
              "scheduled",
              "running",
              "needs_attention",
            ]),
          ),
        )
        .limit(1);
      if (previous.status === "posted" || publication || schedule) {
        // A published/in-flight revision is immutable history. Move only the
        // latest-master identity, so its publish job still points at its words.
        await tx
          .update(contentItems)
          .set({ sourceClientId: `${identity}:archived:${previous.id}` })
          .where(eq(contentItems.id, previous.id));
        previous = undefined;
      }
    }
    const values = {
      title: input.title,
      submissionId: input.submissionId,
      sourceUrl: `yapper://project/${input.projectId}`,
      sourceTitle: "Edited project",
      editorRevision: input.revision,
      editorUpdatedAt: input.editedAt,
      ...recordingScriptPatch(previous ?? {}, input.transcript),
      ...(previous?.recordedTranscript !== (input.transcript || null)
        ? {
            memoryFingerprint: null,
            memoryAttemptedAt: null,
            ...(previous?.memoryFingerprint && !previous.memoryPillarManual
              ? { pillarId: null, pillar: null }
              : {}),
          }
        : {}),
      recordedTranscript: input.transcript || null,
      transcriptStatus: input.transcript
        ? ("ready" as const)
        : ("unavailable" as const),
      status:
        previous?.editorRevision === input.revision
          ? previous.status
          : ("ready" as const),
      updatedAt: new Date(),
    };
    if (previous) {
      const [item] = await tx
        .update(contentItems)
        .set(values)
        .where(eq(contentItems.id, previous.id))
        .returning();
      return item;
    }
    const [item] = await tx
      .insert(contentItems)
      .values({ ...values, userId, sourceClientId: identity, stage: "library" })
      .returning();
    return item;
  });
}
