import {
  createView,
  listViews,
  type LibraryViewRow,
} from "@/lib/db/library-views";
import { ensureUser } from "@/lib/db/users";
import type { ContentStage } from "@/lib/db/schema";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { parseViewInput } from "@/lib/views/input";

/** A creator may not accumulate views without limit; the tab strip stops being
 * navigable long before this, and it caps the seeding loop too. */
export const MAX_VIEWS = 20;

/** Save a new view at the end of one surface's tab strip. The tab strip's
 * "New view" and Chirpy both call this. */
export async function createOwnView(
  userId: string,
  stage: ContentStage,
  body: Record<string, unknown>,
): Promise<OperationResult<LibraryViewRow>> {
  const input = parseViewInput(body);
  if (!input) return refused(400, "bad_view");

  await ensureUser(userId);
  const existing = await listViews(userId, stage);
  if (existing.length >= MAX_VIEWS) return refused(400, "too_many_views");

  return succeeded(await createView(userId, stage, input, existing.length));
}
