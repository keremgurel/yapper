import { invalidateBrainContext } from "@/lib/brain/context/server";
import {
  createBrainBlock,
  deleteBrainBlock,
  reorderBrainBlocks,
  updateBrainBlock,
  type BrainBlockInput,
  type BrainBlockRow,
} from "@/lib/db/project-brain";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

/**
 * Knowledge sections, written the same way from the Brain page (through
 * /api/brain/blocks) and from Chirpy. Every write is scoped by the creator's
 * project as well as the id, so an id from another brain resolves to nothing,
 * and drops the compiled context so the next prompt reads the change.
 */

async function projectFor(userId: string) {
  await ensureUser(userId);
  return getActiveProject(userId);
}

export async function createKnowledge(
  userId: string,
  input: BrainBlockInput,
): Promise<OperationResult<BrainBlockRow>> {
  const project = await projectFor(userId);
  const block = await createBrainBlock(project.id, input);
  invalidateBrainContext(project.id);
  return succeeded(block);
}

/** Absent keys are left alone, so the page autosaves one field at a time. */
export async function updateKnowledge(
  userId: string,
  id: string,
  input: Partial<BrainBlockInput>,
): Promise<OperationResult<BrainBlockRow>> {
  const project = await projectFor(userId);
  const block = await updateBrainBlock(project.id, id, input);
  if (!block) return refused(404, "not_found");
  invalidateBrainContext(project.id);
  return succeeded(block);
}

export async function deleteKnowledge(
  userId: string,
  id: string,
): Promise<OperationResult<true>> {
  const project = await projectFor(userId);
  if (!(await deleteBrainBlock(project.id, id)))
    return refused(404, "not_found");
  invalidateBrainContext(project.id);
  return succeeded(true);
}

/** The creator's own order, as a list of ids. */
export async function reorderKnowledge(
  userId: string,
  order: string[],
): Promise<OperationResult<BrainBlockRow[]>> {
  const project = await projectFor(userId);
  const blocks = await reorderBrainBlocks(project.id, order);
  invalidateBrainContext(project.id);
  return succeeded(blocks);
}
