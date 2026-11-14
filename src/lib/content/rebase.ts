import { merge3 } from "@/lib/content/merge3";
import { normalizeBlocks, normalizeHooks } from "@/lib/content/normalize";
import type { ContentBlock, ContentHook } from "@/lib/db/schema";

/**
 * What a client last read of the fields it is saving. With it, a save that
 * lands after someone else changed the same row (Chirpy from another tab, a
 * second window) is merged into what is stored instead of replacing it.
 */
export interface ContentBase {
  title?: string | null;
  script?: string | null;
  hooks?: string[];
  blocks?: ContentBlock[];
}

/** The fields a rebase reads and writes, as both the item and a version
 * store them. */
export interface RebasedFields {
  title?: string | null;
  script?: string | null;
  hooks?: ContentHook[];
  blocks?: ContentBlock[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** The `base` a client sent, or undefined when it sent none (older clients
 * keep last-writer-wins). */
export function parseContentBase(value: unknown): ContentBase | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const base: ContentBase = {};
  if (raw.title === null || typeof raw.title === "string")
    base.title = raw.title;
  if (raw.script === null || typeof raw.script === "string")
    base.script = raw.script;
  if (Array.isArray(raw.hooks))
    base.hooks = normalizeHooks(raw.hooks).map((hook) => hook.text);
  if (Array.isArray(raw.blocks)) base.blocks = normalizeBlocks(raw.blocks);
  return base;
}

/** Field by field: blocks read back from jsonb come with their keys in a
 * different order than a client sends them. */
export const sameBlock = (a: ContentBlock, b: ContentBlock) =>
  a.label === b.label &&
  a.kind === b.kind &&
  (a.text ?? "") === (b.text ?? "") &&
  (a.items ?? []).join("\n") === (b.items ?? []).join("\n");
const sameList = <T>(
  a: readonly T[],
  b: readonly T[],
  same: (x: T, y: T) => boolean,
) => a.length === b.length && a.every((item, index) => same(item, b[index]));

/** The script the recorder reads: the first script block's words. */
function mirroredScript(blocks: ContentBlock[]): string | null {
  return blocks.find((block) => block.kind === "script")?.text || null;
}

/**
 * The patch with each field that has a base merged into what is stored now.
 * `rebased` is true when the merge kept someone else's change, so the client
 * should show the saved fields instead of its own.
 */
export function rebaseOnto<P extends RebasedFields>(
  patch: P,
  base: ContentBase,
  current: {
    title: string | null;
    script: string | null;
    hooks: unknown;
    blocks: ContentBlock[];
  },
): { patch: P; rebased: boolean } {
  const next: P = { ...patch };
  let rebased = false;

  if (patch.blocks !== undefined && base.blocks !== undefined) {
    const merged = merge3(base.blocks, patch.blocks, current.blocks, sameBlock);
    if (!sameList(merged, patch.blocks, sameBlock)) {
      rebased = true;
      next.blocks = merged;
      // A lead's script mirrors its first script block; keep it that way.
      if (
        patch.script !== undefined &&
        patch.script === mirroredScript(patch.blocks)
      )
        next.script = mirroredScript(merged);
    }
  }
  if (patch.hooks !== undefined && base.hooks !== undefined) {
    const ours = patch.hooks.map((hook) => hook.text);
    const stored = normalizeHooks(current.hooks).map((hook) => hook.text);
    const merged = merge3(base.hooks, ours, stored, Object.is);
    if (!sameList(merged, ours, Object.is)) {
      rebased = true;
      next.hooks = normalizeHooks(merged);
    }
  }
  for (const key of ["title", "script"] as const) {
    if (patch[key] === undefined || base[key] === undefined) continue;
    if (next[key] !== patch[key]) continue;
    // A scalar the creator did not change takes the stored value.
    if (patch[key] === base[key] && current[key] !== base[key]) {
      rebased = true;
      next[key] = current[key];
    }
  }
  return { patch: next, rebased };
}
