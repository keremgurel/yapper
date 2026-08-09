import { listBrainBlocks } from "@/lib/db/project-brain";
import { listPillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import {
  buildProjectContext,
  type ContextTier,
} from "@/lib/content/project-context";

/**
 * Server-side access to the compiled project context.
 *
 * The block is cached by `contextVersion`, which every project and pillar write
 * bumps, so a warm function instance rebuilds it only when the creator actually
 * edits their brain. Compiling is cheap; the point of the cache is to avoid two
 * extra queries on every AI request.
 */

interface CacheEntry {
  version: number;
  pillarNames: string[];
  blocks: Partial<Record<ContextTier, string>>;
}

// Bounded so a long-lived instance serving many users cannot grow without
// limit. Eviction is oldest-inserted-first, which Map iteration gives us free.
const MAX_ENTRIES = 200;
const cache = new Map<string, CacheEntry>();

function readCache(projectId: string, version: number): CacheEntry | null {
  const hit = cache.get(projectId);
  if (!hit) return null;
  if (hit.version !== version) {
    cache.delete(projectId);
    return null;
  }
  return hit;
}

function writeCache(projectId: string, entry: CacheEntry): void {
  cache.set(projectId, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export interface ProjectContext {
  projectId: string;
  /** The compiled block, or "" when the creator has filled nothing in. */
  block: string;
  /** Pillar names, for prompts that must classify into one. The block already
   * lists them, so a prompt should reference this rather than repeat it. */
  pillarNames: string[];
}

/**
 * The creator's context block for a prompt. Creates the project row on first
 * sight, so every caller can assume a project exists.
 */
export async function getProjectContext(
  userId: string,
  tier: ContextTier = "full",
): Promise<ProjectContext> {
  const project = await getActiveProject(userId);

  const cached = readCache(project.id, project.contextVersion);
  const hit = cached?.blocks[tier];
  if (hit !== undefined) {
    return {
      projectId: project.id,
      block: hit,
      pillarNames: cached?.pillarNames ?? [],
    };
  }

  const pillars = await listPillars(project.id);
  // Only for the writing tier. Classification asks which pillar something is,
  // and the creator's own sections cannot answer that question, so the query is
  // skipped rather than paid for on every classify call.
  const brainBlocks = tier === "full" ? await listBrainBlocks(project.id) : [];
  const block = buildProjectContext(project, pillars, {
    tier,
    blocks: brainBlocks,
  });
  const pillarNames = pillars.map((p) => p.name).filter(Boolean);

  writeCache(project.id, {
    version: project.contextVersion,
    pillarNames,
    blocks: { ...(cached?.blocks ?? {}), [tier]: block },
  });
  return { projectId: project.id, block, pillarNames };
}

/**
 * Context for a caller that must not fail because of the brain. Any error
 * (missing project row, database blip) degrades to no context, so an AI feature
 * keeps working exactly as it did before this system existed.
 */
export async function getProjectContextSafe(
  userId: string,
  tier: ContextTier = "full",
): Promise<Omit<ProjectContext, "projectId">> {
  try {
    const { block, pillarNames } = await getProjectContext(userId, tier);
    return { block, pillarNames };
  } catch (error) {
    console.error("[project-context] falling back to no context", error);
    return { block: "", pillarNames: [] };
  }
}

/** Drop a project's cached blocks. Writes bump `contextVersion`, which already
 * invalidates on read; this is for tests and for any path that mutates pillars
 * without going through the version bump. */
export function invalidateProjectContext(projectId: string): void {
  cache.delete(projectId);
}
