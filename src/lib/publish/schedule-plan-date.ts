import { updateContentItem } from "@/lib/db/content";

/**
 * Moves each Library item's planning date to the time its post is now armed
 * for, so Poster and Library show when the video goes out. Best effort: the
 * schedule is what sends, and a failed date write must not fail it.
 */
export async function syncPlanDates(
  userId: string,
  contentItemIds: (string | null | undefined)[],
  scheduledFor: Date,
): Promise<void> {
  const ids = [...new Set(contentItemIds.filter(Boolean))] as string[];
  await Promise.all(
    ids.map((id) =>
      updateContentItem(userId, id, {
        scheduledFor,
      }).catch((error) =>
        console.warn("[schedules] plan date not updated", id, error),
      ),
    ),
  );
}
