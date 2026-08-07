import { pillarsByIds } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";

/** `ok: false` means the id was not one of the caller's own pillars. */
export type PillarOwnership =
  | { ok: true; pillarId: string | null }
  | { ok: false };

/**
 * Resolve a client-supplied pillar id to one the caller actually owns.
 *
 * The foreign key only proves the pillar exists, not whose it is, so without
 * this check a creator could file their item under someone else's pillar by
 * guessing a uuid and then read that pillar's name back out of the item list.
 *
 * Call it only when the field was actually present in the payload: an absent
 * `pillarId` means "leave the classification alone", which is not the same as
 * the explicit null that clears it.
 */
export async function resolveOwnPillar(
  userId: string,
  value: unknown,
): Promise<PillarOwnership> {
  if (value === null || value === "") return { ok: true, pillarId: null };
  if (typeof value !== "string") return { ok: false };

  const project = await getActiveProject(userId);
  const [own] = await pillarsByIds(project.id, [value]);
  return own ? { ok: true, pillarId: own.id } : { ok: false };
}
