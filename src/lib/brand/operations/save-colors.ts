import { parseBrandColors } from "@/lib/brand/colors";
import { updateProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

/** Save the active project's palette, in order, the first color primary. All
 * or nothing: a malformed list is refused rather than clearing the kit. */
export async function saveBrandColors(
  userId: string,
  value: unknown,
): Promise<OperationResult<string[]>> {
  const brandColors = parseBrandColors(value);
  if (!brandColors) return refused(400, "bad_request");
  await ensureUser(userId);
  const project = await updateProject(userId, { brandColors });
  return project ? succeeded(brandColors) : refused(503, "project_unavailable");
}
