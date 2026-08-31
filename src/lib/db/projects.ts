import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { projects } from "./schema";

/** The project fields a creator can edit. Everything else is server-owned. */
export interface ProjectInput {
  name?: string;
  whatIMake?: string;
  audience?: string;
  voice?: string;
  offers?: string;
  doNots?: string;
  links?: string[];
  brandColors?: string[];
}

export type ProjectRow = typeof projects.$inferSelect;

/**
 * The user's project, created blank on first sight.
 *
 * Race-safe: two concurrent first requests both attempt the insert, the
 * `projects_user_unique` index makes one of them a no-op, and the follow-up
 * select returns the single surviving row to both callers. Never returns null.
 */
export async function getActiveProject(userId: string): Promise<ProjectRow> {
  const db = getDb();
  const [inserted] = await db
    .insert(projects)
    .values({ userId })
    .onConflictDoNothing({ target: projects.userId })
    .returning();
  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .limit(1);
  if (existing) return existing;

  // Unreachable in practice: the insert either created the row or conflicted
  // with one that exists. Failing loudly beats returning a fake empty project
  // that would silently strip every prompt of its context.
  throw new Error("project_unavailable");
}

/**
 * Apply an edit and bump `contextVersion` in the same statement, so the
 * compiled-context cache can never serve a stale block after a write.
 */
export async function updateProject(
  userId: string,
  input: ProjectInput,
): Promise<ProjectRow | null> {
  const [row] = await getDb()
    .update(projects)
    .set({
      ...input,
      contextVersion: sql`${projects.contextVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(projects.userId, userId))
    .returning();
  return row ?? null;
}

/**
 * Bump the context version without changing project fields. Used when pillars
 * change, since they are part of the compiled block but live in their own table.
 */
export async function bumpProjectContext(projectId: string): Promise<void> {
  await getDb()
    .update(projects)
    .set({
      contextVersion: sql`${projects.contextVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
}
