import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { contentItems } from "@/lib/db/schema";

/** How an idea is named in a receipt: its title, or the start of the
 * creator's words while it has none. */
export function ideaLabel(row: { title: string; originalNote: string }) {
  const title = row.title.trim();
  if (title) return title.length > 60 ? `${title.slice(0, 57)}…` : title;
  const note = row.originalNote.replace(/\s+/g, " ").trim();
  if (!note) return "Untitled idea";
  return note.length > 40 ? `${note.slice(0, 37)}…` : note;
}

/** Labels for the creator's own ideas among `ids`; ids they do not own are
 * simply absent. */
export async function ideaLabels(
  userId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await getDb()
    .select({
      id: contentItems.id,
      title: contentItems.title,
      originalNote: contentItems.originalNote,
    })
    .from(contentItems)
    .where(
      and(eq(contentItems.userId, userId), inArray(contentItems.id, [...ids])),
    );
  return new Map(rows.map((row) => [row.id, ideaLabel(row)]));
}

/** “Gym myths”, or “Gym myths” and 2 more. */
export function namedList(labels: readonly string[], noun = "idea"): string {
  if (!labels.length) return `no ${noun}s`;
  if (labels.length === 1) return `“${labels[0]}”`;
  if (labels.length === 2) return `“${labels[0]}” and “${labels[1]}”`;
  return `“${labels[0]}” and ${labels.length - 1} more ${noun}s`;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
