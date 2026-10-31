import { updateView, type LibraryViewRow } from "@/lib/db/library-views";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { parseViewInput } from "@/lib/views/input";

/** Replace one of the creator's own views. Owner-scoped, so an id belonging
 * to someone else matches nothing rather than editing their view. */
export async function updateOwnView(
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<OperationResult<LibraryViewRow>> {
  const input = parseViewInput(body);
  if (!input) return refused(400, "bad_view");
  const view = await updateView(userId, id, input);
  return view ? succeeded(view) : refused(404, "not_found");
}
