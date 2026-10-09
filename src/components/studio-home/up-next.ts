import type { ContentStatus } from "@/lib/db/schema";

type Queued = {
  status: ContentStatus;
  scheduledFor: string | null;
  updatedAt: string;
};

/** The rows Home surfaces first: dated work in date order, then the most
 * recently touched drafts. Posted items are finished and stay out. */
export function upNextItems<T extends Queued>(items: T[], limit = 5): T[] {
  const active = items.filter((item) => item.status !== "posted");
  const dated = active
    .filter((item) => item.status === "ready" && item.scheduledFor)
    .sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
  const undated = active
    .filter((item) => !(item.status === "ready" && item.scheduledFor))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [...dated, ...undated].slice(0, limit);
}
