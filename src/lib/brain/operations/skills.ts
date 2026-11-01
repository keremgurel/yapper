import { invalidateBrainContext } from "@/lib/brain/context/server";
import {
  createProjectSkill,
  deleteProjectSkill,
  reorderProjectSkills,
  updateProjectSkill,
  type ProjectSkillInput,
  type ProjectSkillRow,
} from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

/**
 * The creator's skills, written the same way from the Skills tab (through
 * /api/brain/skills) and from Chirpy. Scoped by project as well as id, so an
 * id guessed from another creator's brain resolves to nothing.
 */

async function projectFor(userId: string) {
  await ensureUser(userId);
  return getActiveProject(userId);
}

export async function createSkill(
  userId: string,
  input: ProjectSkillInput,
): Promise<OperationResult<ProjectSkillRow>> {
  const project = await projectFor(userId);
  const skill = await createProjectSkill(project.id, input);
  invalidateBrainContext(project.id);
  return succeeded(skill);
}

/** Save an edit, or flip the switch. Absent keys are left alone. */
export async function updateSkill(
  userId: string,
  id: string,
  input: Partial<ProjectSkillInput>,
): Promise<OperationResult<ProjectSkillRow>> {
  const project = await projectFor(userId);
  const skill = await updateProjectSkill(project.id, id, input);
  if (!skill) return refused(404, "not_found");
  invalidateBrainContext(project.id);
  return succeeded(skill);
}

export async function deleteSkill(
  userId: string,
  id: string,
): Promise<OperationResult<true>> {
  const project = await projectFor(userId);
  if (!(await deleteProjectSkill(project.id, id)))
    return refused(404, "not_found");
  invalidateBrainContext(project.id);
  return succeeded(true);
}

/** The creator's own order, as a list of ids. */
export async function reorderSkills(
  userId: string,
  order: string[],
): Promise<OperationResult<ProjectSkillRow[]>> {
  const project = await projectFor(userId);
  const skills = await reorderProjectSkills(project.id, order);
  invalidateBrainContext(project.id);
  return succeeded(skills);
}
