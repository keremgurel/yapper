import { eq, sql } from "drizzle-orm";
import type { EditRunMeasure } from "@/lib/studio/edit-run";
import { getDb } from "./client";
import { editRuns } from "./schema";

/** Saves one finished 1-Click Edit. A repeat of the same paid request is
 * ignored, so a retry never counts twice. */
export async function recordEditRun(
  userId: string,
  usageId: string,
  measure: EditRunMeasure,
): Promise<void> {
  await getDb()
    .insert(editRuns)
    .values({ userId, usageId, ...measure })
    .onConflictDoNothing({ target: editRuns.usageId });
}

export interface EditRunTotals {
  edits: number;
  footageSeconds: number;
  cutCount: number;
  cutSeconds: number;
  /** When the first counted edit ran, or null before any. */
  since: string | null;
}

/** Everything a creator's 1-Click Edits have done, added up. */
export async function editRunTotals(userId: string): Promise<EditRunTotals> {
  const [row] = await getDb()
    .select({
      edits: sql<number>`count(*)::int`,
      footageSeconds: sql<number>`coalesce(sum(${editRuns.footageSeconds}), 0)::float`,
      cutCount: sql<number>`coalesce(sum(${editRuns.cutCount}), 0)::int`,
      cutSeconds: sql<number>`coalesce(sum(${editRuns.cutSeconds}), 0)::float`,
      since: sql<Date | null>`min(${editRuns.createdAt})`,
    })
    .from(editRuns)
    .where(eq(editRuns.userId, userId));
  return {
    edits: row?.edits ?? 0,
    footageSeconds: row?.footageSeconds ?? 0,
    cutCount: row?.cutCount ?? 0,
    cutSeconds: row?.cutSeconds ?? 0,
    since: row?.since ? new Date(row.since).toISOString() : null,
  };
}
