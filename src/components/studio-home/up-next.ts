import type { ContentSummary } from "@/lib/content/client";

/** The rows Home surfaces first: dated work in date order, then the most
 * recently touched drafts. Posted items are finished and stay out. */
export function upNextItems(
  items: ContentSummary[],
  limit = 5,
): ContentSummary[] {
  const active = items.filter((item) => item.status !== "posted");
  const dated = active
    .filter((item) => item.status === "scheduled" && item.scheduledFor)
    .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
  const undated = active
    .filter((item) => !(item.status === "scheduled" && item.scheduledFor))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [...dated, ...undated].slice(0, limit);
}
