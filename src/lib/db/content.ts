import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "./client";
import {
  contentItems,
  type ContentBlock,
  type ContentHook,
  type ContentStage,
  type ContentStatus,
  type IdeaTypeValue,
  type TranscriptStatus,
} from "./schema";

/** Fields a client may set on a content item (everything else is server-owned). */
export interface ContentItemInput {
  title?: string;
  hooks?: ContentHook[];
  blocks?: ContentBlock[];
  originalNote?: string;
  format?: string | null;
  summary?: string | null;
  ideaType?: IdeaTypeValue | null;
  stage?: ContentStage;
  points?: string[];
  example?: string;
  cta?: string;
  script?: string | null;
  status?: ContentStatus;
  pillar?: string | null;
  pillarId?: string | null;
  projectId?: string | null;
  scheduledFor?: Date | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceTranscript?: string | null;
  sourceSummary?: string | null;
  sourceReferenceType?: string | null;
  sourcePlatform?: string | null;
  transcriptStatus?: TranscriptStatus | null;
  submissionId?: string | null;
}

export async function listContentItems(
  userId: string,
  options: { includePosterUploads?: boolean; stage?: ContentStage } = {},
) {
  const owned = options.includePosterUploads
    ? eq(contentItems.userId, userId)
    : and(
        eq(contentItems.userId, userId),
        or(
          isNull(contentItems.sourceUrl),
          ne(contentItems.sourceUrl, "yapper://poster-upload"),
        ),
      );

  return getDb()
    .select({
      id: contentItems.id,
      title: contentItems.title,
      status: contentItems.status,
      stage: contentItems.stage,
      ideaType: contentItems.ideaType,
      scheduledFor: contentItems.scheduledFor,
      submissionId: contentItems.submissionId,
      pillar: contentItems.pillar,
      pillarId: contentItems.pillarId,
      sourceUrl: contentItems.sourceUrl,
      sourceTitle: contentItems.sourceTitle,
      sourcePlatform: contentItems.sourcePlatform,
      transcriptStatus: contentItems.transcriptStatus,
      script: contentItems.script,
      originalNote: contentItems.originalNote,
      updatedAt: contentItems.updatedAt,
      createdAt: contentItems.createdAt,
    })
    .from(contentItems)
    .where(
      options.stage ? and(owned, eq(contentItems.stage, options.stage)) : owned,
    )
    .orderBy(desc(contentItems.updatedAt))
    .limit(500);
}

/** Flip items between the bank and the library. Scoped to the owner, and a
 * pure stage change: no field is transformed, which is the whole point of the
 * two surfaces sharing one table. Returns how many rows moved. */
export async function setContentStage(
  userId: string,
  ids: string[],
  stage: ContentStage,
): Promise<number> {
  if (!ids.length) return 0;
  const rows = await getDb()
    .update(contentItems)
    .set({ stage, updatedAt: new Date() })
    .where(and(eq(contentItems.userId, userId), inArray(contentItems.id, ids)))
    .returning({ id: contentItems.id });
  return rows.length;
}

/** Bulk delete, scoped to the owner. Returns how many rows were removed. */
export async function deleteContentItems(
  userId: string,
  ids: string[],
): Promise<number> {
  if (!ids.length) return 0;
  const rows = await getDb()
    .delete(contentItems)
    .where(and(eq(contentItems.userId, userId), inArray(contentItems.id, ids)))
    .returning({ id: contentItems.id });
  return rows.length;
}

export async function getContentItem(userId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createContentItem(
  userId: string,
  input: ContentItemInput,
) {
  const [row] = await getDb()
    .insert(contentItems)
    .values({ userId, ...input })
    .returning();
  return row;
}

/** Partial update of the caller's own item. Returns the updated row, or null
 * when the item doesn't exist / isn't theirs. */
export async function updateContentItem(
  userId: string,
  id: string,
  input: ContentItemInput,
) {
  const [row] = await getDb()
    .update(contentItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteContentItem(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await getDb()
    .delete(contentItems)
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .returning({ id: contentItems.id });
  return rows.length > 0;
}

export interface ImportItem extends ContentItemInput {
  /** The original localStorage id; unique per user, so re-runs are no-ops. */
  sourceClientId: string;
  /** Original timestamps, so imported items keep their ordering. */
  createdAt?: Date;
  updatedAt?: Date;
}

/** One-shot batch import of localStorage ideas. One transaction; conflicts on
 * (userId, sourceClientId) are skipped, so a retried import can't duplicate.
 * Returns how many rows were actually inserted. */
export async function importContentItems(
  userId: string,
  items: ImportItem[],
): Promise<number> {
  if (items.length === 0) return 0;
  const inserted = await getDb()
    .insert(contentItems)
    .values(items.map((item) => ({ userId, ...item })))
    .onConflictDoNothing({
      target: [contentItems.userId, contentItems.sourceClientId],
    })
    .returning({ id: contentItems.id });
  return inserted.length;
}

/** Link (or unlink) the latest recording of an item. Scoped to the owner. */
export async function setContentSubmission(
  userId: string,
  id: string,
  submissionId: string | null,
): Promise<boolean> {
  const rows = await getDb()
    .update(contentItems)
    .set({ submissionId, updatedAt: sql`now()` })
    .where(and(eq(contentItems.id, id), eq(contentItems.userId, userId)))
    .returning({ id: contentItems.id });
  return rows.length > 0;
}

/** Every source URL the user has already saved, for import deduplication. */
export async function existingSourceUrls(userId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ url: contentItems.sourceUrl })
    .from(contentItems)
    .where(
      and(eq(contentItems.userId, userId), isNotNull(contentItems.sourceUrl)),
    );
  return rows.map((r) => r.url).filter((u): u is string => Boolean(u));
}
