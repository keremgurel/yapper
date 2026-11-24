import { deleteStyleLook, type StyleLookRow } from "@/lib/db/style-looks";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

/** Delete one of the creator's saved looks. Library templates are not theirs to delete. */
export async function deleteLook(
  userId: string,
  id: string,
): Promise<OperationResult<StyleLookRow>> {
  const removed = await deleteStyleLook(userId, id);
  return removed ? succeeded(removed) : refused(404, "not_found");
}
