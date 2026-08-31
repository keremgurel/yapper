import { createHash } from "node:crypto";
import { SELECTION_FLOOR } from "./budgets";
import type { BrainIndex } from "./digest";
import { selectByRules } from "./select-rules";
import { selectByModel } from "./select-model";
import type {
  BrainBlockSource,
  BrainSelection,
  BrainSkillSource,
  BrainSurface,
} from "./types";

/**
 * Deciding what this prompt loads, and making sure that decision can never be
 * the reason a generation fails.
 *
 * Four things keep the router honest, and they are the whole reason it is
 * affordable to run on every call.
 *
 * It is skipped when there is nothing to decide. A brain with four or fewer
 * routable items loads all of them, so a creator who just filled theirs in
 * never waits on a call that had no choice to make.
 *
 * It is cached. The same brain asking the same thing again routes once, which
 * is exactly what regenerating a script or trying a second set of hooks does.
 *
 * It is bounded. One in-flight call, one short timeout, no retries, and a
 * breaker that stops calling the provider after a run of failures rather than
 * paying the timeout on every request while it is down.
 *
 * And every failure path lands on the rules. Timeout, bad JSON, missing key,
 * rate limit, breaker open: all of them come out as a deterministic selection
 * and a generation that proceeds.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

interface CacheEntry {
  selection: BrainSelection;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(
  projectId: string,
  contextVersion: number,
  surface: BrainSurface,
  task: string,
): string {
  const digest = createHash("sha1").update(task).digest("hex").slice(0, 16);
  return `${projectId}:${contextVersion}:${surface}:${digest}`;
}

function readCache(key: string): BrainSelection | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.selection;
}

function writeCache(key: string, selection: BrainSelection): void {
  cache.set(key, { selection, expiresAt: Date.now() + CACHE_TTL_MS });
  // Oldest-inserted-first, which Map iteration gives us free.
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Tests and the cache-invalidation path. */
export function clearSelectionCache(): void {
  cache.clear();
}

// A run of failures means the provider is down or the model name is wrong, and
// neither is fixed by paying a four second timeout on the next hundred
// requests. Small numbers on purpose: the cost of being wrong is one minute of
// slightly worse selection.
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 60_000;
const breaker = { failures: 0, openUntil: 0 };

export function resetRouterBreaker(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
}

function breakerOpen(): boolean {
  if (breaker.openUntil > Date.now()) return true;
  if (breaker.openUntil) resetRouterBreaker();
  return false;
}

function recordFailure(): void {
  breaker.failures += 1;
  if (breaker.failures >= BREAKER_THRESHOLD) {
    breaker.openUntil = Date.now() + BREAKER_COOLDOWN_MS;
    breaker.failures = 0;
  }
}

export interface SelectOptions {
  projectId: string;
  contextVersion: number;
  index: BrainIndex;
  blocks: Map<string, BrainBlockSource>;
  skills: Map<string, BrainSkillSource>;
  surface: BrainSurface;
  task: string;
  signal?: AbortSignal;
  /** False for the page's preview, which shows what a surface would read
   * without spending a provider call to find out. */
  useModel?: boolean;
  /** Returns false when the creator has routed too often in the last hour.
   * Injected so the pure path stays testable without a database. */
  allow?: () => Promise<boolean>;
}

export async function selectContext(
  options: SelectOptions,
): Promise<BrainSelection> {
  const { index } = options;
  if (!index.entries.length) {
    return { skillRefs: [], contextRefs: [], by: "all" };
  }
  if (index.entries.length <= SELECTION_FLOOR) {
    // A small Brain is cheap to read, but a skill still has a declared place
    // and purpose. Loading every enabled skill here made a caption method alter
    // scripts simply because the creator had only a few skills installed.
    // Route the skills; keep the old small-Brain promise for context, where
    // reading every short fact is both cheap and useful.
    const routed = selectByRules({
      index,
      blocks: options.blocks,
      skills: options.skills,
      surface: options.surface,
      task: options.task,
    });
    return {
      ...routed,
      contextRefs: index.entries
        .filter((entry) => entry.type === "context")
        .map((entry) => entry.ref),
      by: "rules",
    };
  }

  const rules = () =>
    selectByRules({
      index,
      blocks: options.blocks,
      skills: options.skills,
      surface: options.surface,
      task: options.task,
    });

  if (options.useModel === false || breakerOpen()) return rules();

  const key = cacheKey(
    options.projectId,
    options.contextVersion,
    options.surface,
    options.task,
  );
  const cached = readCache(key);
  if (cached) return cached;

  try {
    if (options.allow && !(await options.allow())) return rules();
    const selection = await selectByModel(
      { index, surface: options.surface, task: options.task },
      options.signal,
    );
    resetRouterBreaker();
    writeCache(key, selection);
    return selection;
  } catch (error) {
    recordFailure();
    // Deliberately not surfaced. The creator gets their generation; we get the
    // log line.
    console.warn("[brain/route] falling back to rules", error);
    return rules();
  }
}
