import { and, count, desc, eq } from "drizzle-orm";
import type { TemplateLayer } from "@/lib/style-library/templates/template";
import { getDb } from "./client";
import { styleLooks } from "./schema";

export type StyleLookRow = typeof styleLooks.$inferSelect;

export interface StyleLookInput {
  name: string;
  baseTemplateId: string | null;
  layers: TemplateLayer[];
}

/** A creator's saved looks, the one they touched last first. */
export async function listStyleLooks(userId: string): Promise<StyleLookRow[]> {
  return getDb()
    .select()
    .from(styleLooks)
    .where(eq(styleLooks.userId, userId))
    .orderBy(desc(styleLooks.updatedAt), desc(styleLooks.createdAt));
}

export async function countStyleLooks(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(styleLooks)
    .where(eq(styleLooks.userId, userId));
  return row?.total ?? 0;
}

/** Scoped to the owner, so an id from someone else's account matches nothing. */
export async function getStyleLook(
  userId: string,
  id: string,
): Promise<StyleLookRow | null> {
  const [row] = await getDb()
    .select()
    .from(styleLooks)
    .where(and(eq(styleLooks.id, id), eq(styleLooks.userId, userId)));
  return row ?? null;
}

export async function createStyleLook(
  userId: string,
  input: StyleLookInput,
): Promise<StyleLookRow> {
  const [row] = await getDb()
    .insert(styleLooks)
    .values({ userId, ...input })
    .returning();
  return row;
}

export async function updateStyleLook(
  userId: string,
  id: string,
  input: Partial<Pick<StyleLookInput, "name" | "layers">>,
): Promise<StyleLookRow | null> {
  const [row] = await getDb()
    .update(styleLooks)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(styleLooks.id, id), eq(styleLooks.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteStyleLook(
  userId: string,
  id: string,
): Promise<StyleLookRow | null> {
  const [row] = await getDb()
    .delete(styleLooks)
    .where(and(eq(styleLooks.id, id), eq(styleLooks.userId, userId)))
    .returning();
  return row ?? null;
}
