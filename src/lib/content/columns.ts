import type { ContentSummary } from "@/lib/content/client";
import type { ContentStage } from "@/lib/db/schema";

/**
 * The one column vocabulary both surfaces draw from.
 *
 * The Idea Bank and the Content Library are the same rows at different stages,
 * so they render the same table and differ only in which of these columns are
 * on. Keeping the definition here (rather than one table per surface) is what
 * stops the two drifting apart again.
 */
export type ColumnKey =
  | "title"
  | "pillar"
  | "type"
  | "transcript"
  | "status"
  | "script"
  | "updated"
  | "actions";

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  /** Grid track width. `1fr` for the one column that absorbs slack. */
  width: string;
  /** Whether clicking the header sorts by it. */
  sortable: boolean;
  /** Hidden below `sm`, so a phone shows only what matters. */
  compact: boolean;
}

const COLUMNS: Record<ColumnKey, ColumnDef> = {
  title: {
    key: "title",
    label: "Title",
    width: "1fr",
    sortable: true,
    compact: true,
  },
  pillar: {
    key: "pillar",
    label: "Pillar",
    width: "150px",
    sortable: true,
    compact: false,
  },
  type: {
    key: "type",
    label: "Type",
    width: "120px",
    sortable: true,
    compact: false,
  },
  transcript: {
    key: "transcript",
    label: "Reference",
    width: "130px",
    sortable: false,
    compact: false,
  },
  status: {
    key: "status",
    label: "Status",
    width: "130px",
    sortable: true,
    compact: true,
  },
  script: {
    key: "script",
    label: "Script",
    width: "90px",
    sortable: true,
    compact: false,
  },
  updated: {
    key: "updated",
    label: "Updated",
    width: "150px",
    sortable: true,
    compact: false,
  },
  actions: {
    key: "actions",
    label: "",
    width: "72px",
    sortable: false,
    compact: false,
  },
};

/** What the Idea Bank shows: what an idea IS and whether we could hear its
 * reference. Pipeline status is meaningless before it is in the pipeline. */
export const BANK_COLUMNS: ColumnKey[] = [
  "title",
  "type",
  "pillar",
  "transcript",
  "updated",
];

/** What the Library shows: where an item sits in the pipeline and whether it
 * is ready to shoot. */
export const LIBRARY_COLUMNS: ColumnKey[] = [
  "title",
  "pillar",
  "status",
  "script",
  "updated",
  "actions",
];

export function columnsFor(stage: ContentStage): ColumnKey[] {
  return stage === "bank" ? BANK_COLUMNS : LIBRARY_COLUMNS;
}

export function columnDef(key: ColumnKey): ColumnDef {
  return COLUMNS[key];
}

/**
 * The grid template for a set of columns, including the leading checkbox.
 *
 * Built as an inline style rather than a Tailwind class: the column set is
 * chosen at runtime, and Tailwind only ships classes it can find as literal
 * text in the source, so an interpolated `grid-cols-[…]` would silently
 * produce no CSS at all.
 */
export function gridTemplate(keys: ColumnKey[], compact: boolean): string {
  const tracks = keys
    .filter((key) => !compact || COLUMNS[key].compact)
    .map((key) => COLUMNS[key].width);
  return `28px ${tracks.join(" ")}`;
}

/** Whether a row has anything worth calling a script yet. */
export function hasScript(row: ContentSummary): boolean {
  return Boolean(row.script?.trim());
}
