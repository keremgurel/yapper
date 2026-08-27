import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import {
  contentItems,
  libraryViews,
  projectBrainBlocks,
  projectBrainChunks,
  projectPillars,
  projects,
  projectSkills,
  r2Objects,
  transcriptionDictionary,
  type R2ObjectPurpose,
} from "./schema";

export interface StorageUsageDetails {
  media: Record<R2ObjectPurpose, { bytes: number; count: number }>;
  reservedBytes: number;
  reservedCount: number;
  workspace: {
    estimatedBytes: number;
    projects: number;
    brainBlocks: number;
    brainSkills: number;
    contentIdeas: number;
    contentLibrary: number;
    dictionaryTerms: number;
    savedViews: number;
  };
}

const count = sql<number>`count(*)::int`;

/**
 * A user's storage breakdown. Media bytes are the billable/quota-bearing R2
 * objects. Workspace bytes are an intentionally separate estimate of the
 * user's own Postgres rows: useful for transparency and capacity planning,
 * but far too small to pretend they consume video quota one-for-one.
 */
export async function getStorageUsageDetails(
  userId: string,
): Promise<StorageUsageDetails> {
  const db = getDb();
  const rowBytes = (tableName: string) =>
    sql<number>`coalesce(sum(pg_column_size(${sql.raw(tableName)})), 0)::double precision`;

  const [
    mediaRows,
    [reserved],
    contentRows,
    [projectRows],
    [brainRows],
    [chunkRows],
    [skillRows],
    [pillarRows],
    [dictionaryRows],
    [viewRows],
  ] = await Promise.all([
    db
      .select({
        purpose: r2Objects.purpose,
        count,
        bytes: sql<number>`coalesce(sum(${r2Objects.mediaBytes}), 0)::double precision`,
      })
      .from(r2Objects)
      .where(and(eq(r2Objects.userId, userId), eq(r2Objects.state, "active")))
      .groupBy(r2Objects.purpose),
    db
      .select({
        count,
        bytes: sql<number>`coalesce(sum(${r2Objects.mediaBytes}), 0)::double precision`,
      })
      .from(r2Objects)
      .where(
        and(
          eq(r2Objects.userId, userId),
          eq(r2Objects.state, "pending_upload"),
        ),
      ),
    db
      .select({
        stage: contentItems.stage,
        count,
        bytes: rowBytes("content_items"),
      })
      .from(contentItems)
      .where(eq(contentItems.userId, userId))
      .groupBy(contentItems.stage),
    db
      .select({ count, bytes: rowBytes("projects") })
      .from(projects)
      .where(eq(projects.userId, userId)),
    db
      .select({
        count,
        bytes: rowBytes("project_brain_blocks"),
      })
      .from(projectBrainBlocks)
      .innerJoin(projects, eq(projectBrainBlocks.projectId, projects.id))
      .where(eq(projects.userId, userId)),
    db
      .select({ count, bytes: rowBytes("project_brain_chunks") })
      .from(projectBrainChunks)
      .innerJoin(
        projectBrainBlocks,
        eq(projectBrainChunks.blockId, projectBrainBlocks.id),
      )
      .innerJoin(projects, eq(projectBrainBlocks.projectId, projects.id))
      .where(eq(projects.userId, userId)),
    db
      .select({ count, bytes: rowBytes("project_skills") })
      .from(projectSkills)
      .innerJoin(projects, eq(projectSkills.projectId, projects.id))
      .where(eq(projects.userId, userId)),
    db
      .select({ count, bytes: rowBytes("project_pillars") })
      .from(projectPillars)
      .innerJoin(projects, eq(projectPillars.projectId, projects.id))
      .where(eq(projects.userId, userId)),
    db
      .select({ count, bytes: rowBytes("transcription_dictionary") })
      .from(transcriptionDictionary)
      .where(eq(transcriptionDictionary.userId, userId)),
    db
      .select({ count, bytes: rowBytes("library_views") })
      .from(libraryViews)
      .where(eq(libraryViews.userId, userId)),
  ]);

  const media: StorageUsageDetails["media"] = {
    recording: { bytes: 0, count: 0 },
    import: { bytes: 0, count: 0 },
    thumbnail: { bytes: 0, count: 0 },
  };
  for (const row of mediaRows) {
    media[row.purpose] = {
      bytes: Number(row.bytes),
      count: Number(row.count),
    };
  }

  const ideas = contentRows.find((row) => row.stage === "bank");
  const library = contentRows.find((row) => row.stage === "library");
  const workspaceRows = [
    ...contentRows,
    projectRows,
    brainRows,
    chunkRows,
    skillRows,
    pillarRows,
    dictionaryRows,
    viewRows,
  ];

  return {
    media,
    reservedBytes: Number(reserved?.bytes ?? 0),
    reservedCount: Number(reserved?.count ?? 0),
    workspace: {
      estimatedBytes: workspaceRows.reduce(
        (total, row) => total + Number(row?.bytes ?? 0),
        0,
      ),
      projects: Number(projectRows?.count ?? 0),
      brainBlocks: Number(brainRows?.count ?? 0),
      brainSkills: Number(skillRows?.count ?? 0),
      contentIdeas: Number(ideas?.count ?? 0),
      contentLibrary: Number(library?.count ?? 0),
      dictionaryTerms: Number(dictionaryRows?.count ?? 0),
      savedViews: Number(viewRows?.count ?? 0),
    },
  };
}
