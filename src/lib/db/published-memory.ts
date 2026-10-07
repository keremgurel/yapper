import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { MemoryPlan } from "@/lib/brain/context/published-memory-plan";
import { getDb } from "./client";
import { contentItems, projectPillars, publishJobs } from "./schema";

export const MEMORY_SCRIPT_CHARS = 4000;

/** Query first, read only the matched scripts. No library-wide SELECT of bodies.
 * Publication timestamps, not autosave times, determine the latest examples. */
export async function readPublishedMemory(
  userId: string,
  projectId: string,
  plan: MemoryPlan,
) {
  if (plan.mode === "none") return [];
  const speech = sql<string>`coalesce(nullif(btrim(${contentItems.recordedTranscript}), ''), nullif(btrim(${contentItems.script}), ''), (select string_agg(b->>'text', E'\n') from jsonb_array_elements(${contentItems.blocks}) b where b->>'kind' = 'script'), '')`;
  const publishedAt = sql<Date>`coalesce((select max(${publishJobs.updatedAt}) from ${publishJobs} where ${publishJobs.contentItemId} = ${contentItems.id} and ${publishJobs.userId} = ${userId} and ${publishJobs.status} = 'published'), ${contentItems.createdAt})`;
  const filter =
    plan.mode === "pillar"
      ? or(
          eq(contentItems.pillarId, plan.pillarId),
          and(
            isNull(contentItems.pillarId),
            sql`lower(btrim(${contentItems.pillar})) = (select lower(btrim(${projectPillars.name})) from ${projectPillars} where ${projectPillars.id} = ${plan.pillarId} and ${projectPillars.projectId} = ${projectId})`,
          ),
        )
      : plan.mode === "title"
        ? sql`regexp_replace(lower(${contentItems.title}), '[^[:alnum:]]', '', 'g') = regexp_replace(lower(${plan.query}), '[^[:alnum:]]', '', 'g')`
        : sql`to_tsvector('simple', ${contentItems.title} || ' ' || ${speech}) @@ plainto_tsquery('simple', ${plan.query})`;
  return getDb()
    .select({
      id: contentItems.id,
      title: contentItems.title,
      pillar: sql<
        string | null
      >`coalesce(${projectPillars.name}, ${contentItems.pillar})`,
      script: sql<string>`left(${speech}, ${MEMORY_SCRIPT_CHARS})`,
      truncated: sql<boolean>`length(${speech}) > ${MEMORY_SCRIPT_CHARS}`,
      publishedAt,
    })
    .from(contentItems)
    .leftJoin(
      projectPillars,
      and(
        eq(contentItems.pillarId, projectPillars.id),
        eq(projectPillars.projectId, projectId),
      ),
    )
    .where(
      and(
        eq(contentItems.userId, userId),
        eq(contentItems.status, "posted"),
        or(
          isNull(contentItems.projectId),
          eq(contentItems.projectId, projectId),
        ),
        sql`length(btrim(${speech})) > 0`,
        filter,
      ),
    )
    .orderBy(desc(publishedAt), desc(contentItems.id))
    .limit(Math.max(1, Math.min(3, plan.limit)));
}
