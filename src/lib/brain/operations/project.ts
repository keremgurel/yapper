import { invalidateBrainContext } from "@/lib/brain/context/server";
import {
  listPillars,
  replacePillars,
  type PillarInput,
  type PillarRow,
} from "@/lib/db/project-pillars";
import {
  getActiveProject,
  updateProject,
  type ProjectInput,
  type ProjectRow,
} from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

/**
 * Save edits to the Essentials and pillars. Fields and pillars can arrive
 * together or apart: absent fields are left alone, and `pillars` null leaves
 * the list alone while an empty list removes every pillar. The Brain sheet's
 * autosave (through PATCH /api/project) and Chirpy share it.
 */
export async function saveProjectBrain(
  userId: string,
  fields: ProjectInput,
  pillars: PillarInput[] | null,
): Promise<OperationResult<{ project: ProjectRow; pillars: PillarRow[] }>> {
  await ensureUser(userId);
  let project = await getActiveProject(userId);

  if (Object.keys(fields).length) {
    const saved = await updateProject(userId, fields);
    if (!saved) return refused(404, "not_found");
    project = saved;
  }

  let rows: PillarRow[];
  if (pillars) {
    rows = await replacePillars(project.id, pillars);
    // replacePillars bumps contextVersion too, so the row read above is now one
    // behind. Re-read rather than hand the client a version that never existed.
    project = await getActiveProject(userId);
  } else {
    rows = await listPillars(project.id);
  }

  // Both writes bump contextVersion, which already invalidates on read. This
  // drops the entry outright so the very next prompt on this warm instance
  // cannot serve the block the creator just edited away.
  invalidateBrainContext(project.id);
  return succeeded({ project, pillars: rows });
}
