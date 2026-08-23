import { listBrainBlocks, listBrainChunks } from "@/lib/db/project-brain";
import { listPillars } from "@/lib/db/project-pillars";
import { listProjectSkills } from "@/lib/db/project-skills";
import { getActiveProject } from "@/lib/db/projects";
import { guardRouterSpend } from "@/lib/provider-rate-limit";
import { compileBrain, type CompiledBrain } from "./compile";
import { clearSelectionCache } from "./select";
import type {
  BrainBlockSource,
  BrainSnapshot,
  BrainSurface,
  BrainUsed,
} from "./types";

/**
 * Server-side access to the compiled brain.
 *
 * The snapshot is cached by `contextVersion`, which every project, pillar,
 * block and skill write bumps, so a warm function instance re-reads the
 * database only when the creator actually edits their brain. Compiling is
 * cheap; the point of the cache is to keep four extra queries off the path of
 * every AI request.
 *
 * Note that what is cached here is the rows, not a finished string. The core
 * and index are stable per version, but the loaded part depends on the task, so
 * a cache of finished text would miss on every request that differed by a word.
 */

interface CacheEntry {
  version: number;
  snapshot: BrainSnapshot;
}

// Bounded so a long-lived instance serving many users cannot grow without
// limit. Eviction is oldest-inserted-first, which Map iteration gives us free.
const MAX_ENTRIES = 200;
const cache = new Map<string, CacheEntry>();

function readCache(projectId: string, version: number): BrainSnapshot | null {
  const hit = cache.get(projectId);
  if (!hit) return null;
  if (hit.version !== version) {
    cache.delete(projectId);
    return null;
  }
  return hit.snapshot;
}

function writeCache(projectId: string, entry: CacheEntry): void {
  cache.set(projectId, entry);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Drop a project's cached snapshot. Writes bump `contextVersion`, which
 * already invalidates on read; this is for tests and for any path that mutates
 * the brain without going through the version bump. */
export function invalidateBrainContext(projectId: string): void {
  cache.delete(projectId);
  clearSelectionCache();
}

async function loadSnapshot(
  projectId: string,
  version: number,
): Promise<BrainSnapshot> {
  const cached = readCache(projectId, version);
  if (cached) return cached;

  const [blockRows, pillars, skillRows] = await Promise.all([
    listBrainBlocks(projectId),
    listPillars(projectId),
    listProjectSkills(projectId),
  ]);

  // One query for every document's slices rather than one per document.
  const docIds = blockRows
    .filter((row) => row.kind === "doc")
    .map((row) => row.id);
  const chunkRows = await listBrainChunks(docIds);
  const chunksByBlock = new Map<string, BrainBlockSource["chunks"]>();
  for (const chunk of chunkRows) {
    const list = chunksByBlock.get(chunk.blockId) ?? [];
    list.push({ ord: chunk.ord, heading: chunk.heading, text: chunk.text });
    chunksByBlock.set(chunk.blockId, list);
  }

  const snapshot: BrainSnapshot = {
    project: null,
    pillars: pillars.map((pillar) => ({
      name: pillar.name,
      description: pillar.description,
      examples: pillar.examples,
    })),
    blocks: blockRows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      usage: row.usage,
      digest: row.digest,
      body: row.body,
      items: row.items,
      rows: row.rows,
      tags: row.tags,
      sourceLabel: row.sourceLabel,
      chunks: chunksByBlock.get(row.id),
    })),
    skills: skillRows.map((row) => ({
      id: row.id,
      name: row.name,
      whenToUse: row.whenToUse,
      instructions: row.instructions,
      surfaces: row.surfaces,
      enabled: row.enabled,
    })),
  };

  writeCache(projectId, { version, snapshot });
  return snapshot;
}

export interface BrainContextOptions {
  surface: BrainSurface;
  /** What is being written. Selection reads it; leaving it out is fine. */
  task?: string;
  signal?: AbortSignal;
  /** False for the page's preview, which must not spend a router call. */
  useModel?: boolean;
}

export interface BrainContext {
  projectId: string;
  /** Ready to append to a system prompt, or "" when the brain is empty. */
  section: string;
  /** Pillar names, for prompts that must classify into one. The section
   * already lists them, so a prompt should reference this rather than repeat
   * it. */
  pillarNames: string[];
  /** What was actually read, for the page to show the creator. */
  used: BrainUsed;
}

/**
 * The creator's brain for a prompt. Creates the project row on first sight, so
 * every caller can assume a project exists.
 */
export async function getBrainContext(
  userId: string,
  options: BrainContextOptions,
): Promise<BrainContext> {
  const project = await getActiveProject(userId);
  const snapshot = await loadSnapshot(project.id, project.contextVersion);
  const compiled = await compileBrain(
    { ...snapshot, project },
    {
      surface: options.surface,
      task: options.task,
      projectId: project.id,
      contextVersion: project.contextVersion,
      signal: options.signal,
      useModel: options.useModel,
      allow: () => guardRouterSpend(userId),
    },
  );

  return {
    projectId: project.id,
    section: compiled.section,
    pillarNames: snapshot.pillars.map((p) => p.name).filter(Boolean),
    used: compiled.used,
  };
}

/**
 * Context for a caller that must not fail because of the brain. Any error
 * (missing project row, database blip, provider outage) degrades to no context,
 * so an AI feature keeps working exactly as it did before this system existed.
 */
export async function getBrainContextSafe(
  userId: string,
  options: BrainContextOptions,
): Promise<Omit<BrainContext, "projectId">> {
  try {
    const { section, pillarNames, used } = await getBrainContext(
      userId,
      options,
    );
    return { section, pillarNames, used };
  } catch (error) {
    console.error("[brain/context] falling back to no context", error);
    return { section: "", pillarNames: [], used: { skills: [], context: [] } };
  }
}

/**
 * The full compilation, for the page's preview. Never calls the router: the
 * preview answers "what would this surface read", and spending a provider call
 * every time the creator changes the dropdown is not worth the extra accuracy.
 */
export async function previewBrainContext(
  userId: string,
  surface: BrainSurface,
  task = "",
): Promise<CompiledBrain & { projectId: string }> {
  const project = await getActiveProject(userId);
  const snapshot = await loadSnapshot(project.id, project.contextVersion);
  const compiled = await compileBrain(
    { ...snapshot, project },
    {
      surface,
      task,
      projectId: project.id,
      contextVersion: project.contextVersion,
      useModel: false,
    },
  );
  return { ...compiled, projectId: project.id };
}
