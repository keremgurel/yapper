import { contentStatuses, type ContentStatus } from "@/lib/db/schema";
import type { ContentSummary } from "@/lib/content/client";

/** The columns the library table can sort by. */
export type ContentSortKey = "title" | "status" | "updated";
export type SortDir = "asc" | "desc";

export interface ContentSort {
  key: ContentSortKey;
  dir: SortDir;
}

/** Newest edits first: the library's default resting order. */
export const DEFAULT_CONTENT_SORT: ContentSort = {
  key: "updated",
  dir: "desc",
};

/** The direction a column jumps to the first time you click it. Names and the
 * pipeline read most naturally ascending (A→Z, drafted→posted); time reads
 * newest-first, which is what "what did I touch last" wants. */
export function defaultDirFor(key: ContentSortKey): SortDir {
  return key === "updated" ? "desc" : "asc";
}

/** How a row's title reads in the table, so sorting matches what the eye sees:
 * an empty title shows as "Untitled idea", so that is what it sorts as. */
function titleKey(row: ContentSummary): string {
  return (row.title.trim() || "Untitled idea").toLowerCase();
}

function statusRank(status: ContentStatus): number {
  return contentStatuses.indexOf(status);
}

/** Compare two rows on one column, always ascending. `sortContent` flips the
 * sign for descending, so a tie here (0) leaves the rows in their incoming
 * order under a stable sort. */
function compareAsc(
  a: ContentSummary,
  b: ContentSummary,
  key: ContentSortKey,
): number {
  switch (key) {
    case "title":
      return titleKey(a).localeCompare(titleKey(b));
    case "status":
      return statusRank(a.status) - statusRank(b.status);
    case "updated":
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  }
}

/** Return a sorted copy of the rows. Pure (never mutates the input) and stable:
 * rows that tie on the sort column keep their existing order, so toggling a
 * column never scrambles equal rows. */
export function sortContent(
  rows: ContentSummary[],
  sort: ContentSort,
): ContentSummary[] {
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compareAsc(a, b, sort.key) * factor);
}
