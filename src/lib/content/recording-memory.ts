import { createHash } from "node:crypto";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getContentItem } from "@/lib/db/content";
import { listPillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { contentItems, projectPillars } from "@/lib/db/schema";
import { guardRouterSpend } from "@/lib/provider-rate-limit";
import { classifyRecording } from "./classify-recording";
import { loadRecordedTranscript } from "./recorded-transcript";
import { recordingScriptPatch } from "./recording-script";

/** Copy existing speech into an empty canvas. No provider, no new transcription.
 * Read again under a row lock so a concurrent autosave always wins. */
export async function hydrateRecording(userId: string, id: string) {
  const item = await getContentItem(userId, id);
  if (!item || item.transcriptStatus === "pending") return item;
  // An explicitly empty, completed export means silence, not a missing take.
  if (item.transcriptStatus === "ready" && item.recordedTranscript === "")
    return item;
  const transcript = await loadRecordedTranscript(userId, item);
  if (!transcript) return item;
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.userId, userId), eq(contentItems.id, id)))
      .for("update")
      .limit(1);
    if (!current) return null;
    if (
      current.recordedTranscript !== item.recordedTranscript ||
      current.submissionId !== item.submissionId ||
      current.transcriptStatus !== item.transcriptStatus
    )
      return current;
    const patch = recordingScriptPatch(current, transcript);
    if (
      current.recordedTranscript === transcript &&
      (!patch.script ||
        (patch.script === current.script &&
          JSON.stringify(patch.blocks ?? current.blocks) ===
            JSON.stringify(current.blocks)))
    )
      return current;
    const [saved] = await tx
      .update(contentItems)
      .set({
        ...patch,
        recordedTranscript: transcript,
        transcriptStatus: "ready",
      })
      .where(eq(contentItems.id, id))
      .returning();
    return saved;
  });
}

/** Fallible enrichment must never turn an already-published post into a failure.
 * Durable lease prevents duplicate provider calls across tabs/instances; failed
 * attempts can be retried after five minutes. Successful no-match is remembered. */
export async function enrichRecording(
  userId: string,
  id: string,
): Promise<void> {
  try {
    const item = await hydrateRecording(userId, id);
    if (
      !item?.recordedTranscript?.trim() ||
      item.memoryPillarManual ||
      item.pillarId ||
      item.pillar?.trim() ||
      !process.env.SURPLUS_API_KEY
    )
      return;
    const project = await getActiveProject(userId);
    if (item.projectId && item.projectId !== project.id) return;
    const pillars = await listPillars(project.id);
    if (!pillars.length) return;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          item.title,
          item.recordedTranscript,
          pillars.map((p) => [p.id, p.name, p.description, p.examples]),
        ]),
      )
      .digest("hex");
    if (item.memoryFingerprint === fingerprint) return;
    const now = new Date();
    const [claimed] = await getDb()
      .update(contentItems)
      .set({ memoryAttemptedAt: now })
      .where(
        and(
          eq(contentItems.userId, userId),
          eq(contentItems.id, id),
          or(
            isNull(contentItems.memoryAttemptedAt),
            lt(
              contentItems.memoryAttemptedAt,
              new Date(now.getTime() - 300_000),
            ),
          ),
        ),
      )
      .returning({ id: contentItems.id });
    if (!claimed || !(await guardRouterSpend(userId))) return;
    const pillarId = await classifyRecording(
      item.title,
      item.recordedTranscript,
      pillars,
    );
    await getDb().transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(contentItems)
        .where(and(eq(contentItems.userId, userId), eq(contentItems.id, id)))
        .for("update")
        .limit(1);
      if (
        !current ||
        current.memoryAttemptedAt?.getTime() !== now.getTime() ||
        current.title !== item.title ||
        current.projectId !== item.projectId ||
        current.recordedTranscript !== item.recordedTranscript ||
        current.memoryPillarManual ||
        current.pillarId ||
        current.pillar?.trim()
      )
        return;
      // Pillars can be deleted or renamed while the provider is answering.
      if (pillarId) {
        const [pillar] = await tx
          .select()
          .from(projectPillars)
          .where(
            and(
              eq(projectPillars.id, pillarId),
              eq(projectPillars.projectId, project.id),
            ),
          )
          .for("share")
          .limit(1);
        if (!pillar) return;
      }
      await tx
        .update(contentItems)
        .set({
          memoryFingerprint: fingerprint,
          ...(pillarId
            ? { pillarId, pillar: null, projectId: project.id }
            : {}),
        })
        .where(eq(contentItems.id, id));
    });
  } catch (error) {
    console.warn("[recording-memory] enrichment deferred", error);
  }
}

/** Repair old posted entries in small batches on library visits. Missing speech
 * is never invented. Old Poster uploads are included, even after media expiry. */
export async function repairPostedRecordings(userId: string): Promise<void> {
  try {
    const rows = await getDb()
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.userId, userId),
          eq(contentItems.status, "posted"),
          or(
            sql`nullif(btrim(${contentItems.recordedTranscript}), '') is not null`,
            sql`${contentItems.submissionId} is not null`,
            eq(contentItems.sourceUrl, "yapper://poster-upload"),
            eq(contentItems.sourceUrl, "yapper://poster-upload/completed"),
          ),
          or(
            and(
              eq(contentItems.memoryScriptManual, false),
              sql`nullif(btrim(${contentItems.script}), '') is null`,
            ),
            and(
              eq(contentItems.memoryPillarManual, false),
              isNull(contentItems.pillarId),
              sql`nullif(btrim(${contentItems.pillar}), '') is null`,
              isNull(contentItems.memoryFingerprint),
            ),
          ),
          or(
            isNull(contentItems.memoryAttemptedAt),
            lt(contentItems.memoryAttemptedAt, new Date(Date.now() - 300_000)),
          ),
        ),
      )
      .orderBy(
        sql`${contentItems.memoryAttemptedAt} asc nulls first`,
        desc(contentItems.createdAt),
      )
      .limit(3);
    for (const row of rows) {
      // Mark even a missing transcript as attempted so it cannot starve older rows.
      await enrichRecording(userId, row.id);
      await getDb()
        .update(contentItems)
        .set({ memoryAttemptedAt: new Date() })
        .where(
          and(
            eq(contentItems.userId, userId),
            eq(contentItems.id, row.id),
            or(
              isNull(contentItems.memoryAttemptedAt),
              lt(
                contentItems.memoryAttemptedAt,
                new Date(Date.now() - 300_000),
              ),
            ),
          ),
        );
    }
  } catch (error) {
    console.warn("[recording-memory] repair deferred", error);
  }
}
