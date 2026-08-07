import { CONTENT_FORMATS } from "@/lib/content/formats";
import type { ContentSummary } from "@/lib/content/client";
import type { LibraryGrouping } from "@/lib/db/schema";
import { contentStatuses } from "@/lib/db/schema";

export interface ItemGroup {
  /** Stable key for React and for drop targets. */
  key: string;
  label: string;
  items: ContentSummary[];
}

const STATUS_LABEL: Record<string, string> = {
  drafted: "Drafted",
  planned: "Planned",
  scheduled: "Scheduled",
  posted: "Posted",
};

/** Rows that match every active filter. Absent or empty filters do not narrow
 * anything, so a brand-new view shows the whole surface. */
export function applyViewFilters(
  rows: ContentSummary[],
  filters: Record<string, string[]>,
): ContentSummary[] {
  const status = filters.status ?? [];
  const formats = filters.formats ?? [];
  const pillarId = filters.pillarId ?? [];

  return rows.filter((row) => {
    if (status.length && !status.includes(row.status)) return false;
    if (pillarId.length && !pillarId.includes(row.pillarId ?? "")) return false;
    // Formats are a set on the row: matching any one of the wanted ids is a
    // hit, because "show me shorts" should still surface a short-and-article.
    if (
      formats.length &&
      !(row.formats ?? []).some((f) => formats.includes(f))
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Split rows into the groups a view renders as board columns or table sections.
 *
 * Status groups are always all present, in pipeline order, even when empty: an
 * empty "Scheduled" column is information (nothing is queued) and it has to
 * exist as a drop target anyway. Pillar and format groups only appear when
 * something is in them, because the full list of either is long and mostly
 * irrelevant on any given day.
 */
export function groupItems(
  rows: ContentSummary[],
  groupBy: LibraryGrouping | null,
): ItemGroup[] {
  if (!groupBy) return [{ key: "all", label: "All", items: rows }];

  if (groupBy === "status") {
    return contentStatuses.map((status) => ({
      key: status,
      label: STATUS_LABEL[status] ?? status,
      items: rows.filter((r) => r.status === status),
    }));
  }

  if (groupBy === "format") {
    const groups = CONTENT_FORMATS.map((format) => ({
      key: format.id,
      label: format.label,
      items: rows.filter((r) => (r.formats ?? []).includes(format.id)),
    })).filter((g) => g.items.length);
    // An item with no format at all would otherwise vanish from this view.
    const none = rows.filter((r) => !(r.formats ?? []).length);
    return none.length
      ? [...groups, { key: "__none", label: "No format", items: none }]
      : groups;
  }

  const byPillar = new Map<string, ItemGroup>();
  rows.forEach((row) => {
    const key = row.pillarId ?? row.pillar ?? "__none";
    const label = row.pillar ?? "No pillar";
    const group = byPillar.get(key) ?? { key, label, items: [] };
    group.items.push(row);
    byPillar.set(key, group);
  });

  return [...byPillar.values()].sort((a, b) => {
    // The unclassified bucket sorts last: it is a to-do, not a category.
    if (a.key === "__none") return 1;
    if (b.key === "__none") return -1;
    return a.label.localeCompare(b.label);
  });
}
