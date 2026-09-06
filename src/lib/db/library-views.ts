import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import {
  libraryViews,
  type ContentStage,
  type LibraryGrouping,
  type LibraryViewKind,
} from "./schema";

export type LibraryViewRow = typeof libraryViews.$inferSelect;

export interface LibraryViewInput {
  name: string;
  kind: LibraryViewKind;
  groupBy: LibraryGrouping | null;
  filters: Record<string, string[]>;
  columns: string[];
}

export async function listViews(
  userId: string,
  stage: ContentStage,
): Promise<LibraryViewRow[]> {
  return getDb()
    .select()
    .from(libraryViews)
    .where(and(eq(libraryViews.userId, userId), eq(libraryViews.stage, stage)))
    .orderBy(asc(libraryViews.sortOrder), asc(libraryViews.createdAt));
}

export async function createView(
  userId: string,
  stage: ContentStage,
  input: LibraryViewInput,
  sortOrder: number,
): Promise<LibraryViewRow> {
  const [row] = await getDb()
    .insert(libraryViews)
    .values({ userId, stage, sortOrder, ...input })
    .returning();
  return row;
}

/** Scoped to the owner, so an id from someone else's account matches nothing
 * rather than editing their view. */
export async function updateView(
  userId: string,
  id: string,
  input: Partial<LibraryViewInput> & { sortOrder?: number },
): Promise<LibraryViewRow | null> {
  const [row] = await getDb()
    .update(libraryViews)
    .set(input)
    .where(and(eq(libraryViews.id, id), eq(libraryViews.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteView(userId: string, id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(libraryViews)
    .where(and(eq(libraryViews.id, id), eq(libraryViews.userId, userId)))
    .returning({ id: libraryViews.id });
  return rows.length > 0;
}

/**
 * The views a creator starts with, created once when they have none.
 *
 * Seeded rather than hardcoded in the UI so they behave like any other view
 * from the first second: renameable, reorderable, deletable. A built-in that
 * cannot be edited is a different kind of object, and having two kinds is what
 * makes view systems confusing.
 */
export async function seedViewsIfEmpty(
  userId: string,
  stage: ContentStage,
): Promise<LibraryViewRow[]> {
  const defaults: LibraryViewInput[] =
    stage === "bank"
      ? [
          {
            name: "All ideas",
            kind: "table",
            groupBy: null,
            filters: {},
            columns: [],
          },
          {
            name: "By pillar",
            kind: "table",
            groupBy: "pillar",
            filters: {},
            columns: [],
          },
        ]
      : [
          {
            name: "All",
            kind: "table",
            groupBy: null,
            filters: {},
            columns: [],
          },
          {
            name: "Not posted",
            kind: "table",
            groupBy: null,
            filters: { status: ["drafted", "planned", "scheduled"] },
            columns: [],
          },
          {
            name: "By status",
            kind: "board",
            groupBy: "status",
            filters: {},
            columns: [],
          },
          {
            name: "By pillar",
            kind: "board",
            groupBy: "pillar",
            filters: {},
            columns: [],
          },
        ];

  return getDb().transaction(async (tx) => {
    // Two tabs can load a new workspace together. Keep the empty check and
    // complete default set in one owner/stage lock and one atomic commit.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`library-views:${userId}:${stage}`}))`,
    );
    const existing = await tx
      .select()
      .from(libraryViews)
      .where(
        and(eq(libraryViews.userId, userId), eq(libraryViews.stage, stage)),
      )
      .orderBy(asc(libraryViews.sortOrder), asc(libraryViews.createdAt));
    if (existing.length) return existing;
    return tx
      .insert(libraryViews)
      .values(
        defaults.map((view, sortOrder) => ({
          userId,
          stage,
          sortOrder,
          ...view,
        })),
      )
      .returning();
  });
}
