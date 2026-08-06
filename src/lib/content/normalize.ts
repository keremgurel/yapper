import type { ContentBlock, ContentHook } from "@/lib/db/schema";

/**
 * Read-through normalization for content items.
 *
 * Rows written before the flexible body existed carry `points` / `example` /
 * `cta` columns and plain-string hooks. Rather than rewriting those rows (a
 * destructive migration that could only ever lose information), they are
 * widened on read: legacy columns become blocks, legacy hook strings become
 * hook objects with no pattern attached.
 *
 * Pure and side-effect free, so both the API and the client can apply it and
 * the mapping can be tested without a database.
 */

/** The legacy shape, as it still exists in the database. */
export interface LegacyBody {
  hooks?: unknown;
  blocks?: unknown;
  points?: unknown;
  example?: string | null;
  cta?: string | null;
}

export interface NormalizedBody {
  hooks: ContentHook[];
  blocks: ContentBlock[];
}

const BLOCK_KINDS = new Set<ContentBlock["kind"]>([
  "paragraph",
  "bullets",
  "steps",
  "script",
]);

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
}

/** Hooks are either the new objects or the legacy plain strings. A legacy hook
 * keeps its text and simply has no pattern, which the UI renders as an untagged
 * hook rather than inventing an archetype it was never written against. */
export function normalizeHooks(value: unknown): ContentHook[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ContentHook[] => {
    if (typeof entry === "string") {
      const text = entry.trim();
      return text ? [{ text, pattern: null, why: null }] : [];
    }
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    if (!text) return [];
    return [
      {
        text,
        pattern: typeof raw.pattern === "string" ? raw.pattern : null,
        why: typeof raw.why === "string" ? raw.why : null,
      },
    ];
  });
}

/** Parse stored blocks, dropping anything malformed or empty so the renderer
 * never has to guard each field. */
export function normalizeBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): ContentBlock[] => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    const kind =
      typeof raw.kind === "string" &&
      BLOCK_KINDS.has(raw.kind as ContentBlock["kind"])
        ? (raw.kind as ContentBlock["kind"])
        : null;
    const text = typeof raw.text === "string" ? raw.text.trim() : "";
    const items = strings(raw.items);
    if (!label || !kind || (!text && !items.length)) return [];
    return [
      {
        label,
        kind,
        ...(text ? { text } : {}),
        ...(items.length ? { items } : {}),
      },
    ];
  });
}

/**
 * The item's body, with legacy columns folded in.
 *
 * Stored blocks win outright: once a row has a real body, the legacy columns
 * are stale leftovers and must not be appended back on top of it. Only a row
 * with no blocks at all falls back to reconstructing them.
 */
export function normalizeBody(row: LegacyBody): NormalizedBody {
  const hooks = normalizeHooks(row.hooks);
  const blocks = normalizeBlocks(row.blocks);
  if (blocks.length) return { hooks, blocks };

  const legacy: ContentBlock[] = [];
  const points = strings(row.points);
  if (points.length) {
    legacy.push({ label: "Key points", kind: "bullets", items: points });
  }
  const example = (row.example ?? "").trim();
  if (example) {
    legacy.push({ label: "Example", kind: "paragraph", text: example });
  }
  const cta = (row.cta ?? "").trim();
  if (cta) {
    legacy.push({ label: "Call to action", kind: "paragraph", text: cta });
  }
  return { hooks, blocks: legacy };
}

/** True when a row still depends on the legacy columns to render anything.
 * Lets the eventual drop-column migration be gated on real data rather than a
 * guess about whether anything still needs them. */
export function usesLegacyBody(row: LegacyBody): boolean {
  if (normalizeBlocks(row.blocks).length) return false;
  return (
    strings(row.points).length > 0 ||
    Boolean((row.example ?? "").trim()) ||
    Boolean((row.cta ?? "").trim())
  );
}

/** Just the hook lines, for the places that render or speak them (teleprompter,
 * script assembly, the plain-text editor). */
export function hookTexts(hooks: unknown): string[] {
  return normalizeHooks(hooks).map((h) => h.text);
}

/**
 * Fold edited hook lines back into hook objects, keeping each hook's pattern
 * attribution where the text at that position is unchanged.
 *
 * Without this, editing one hook in a plain-text list would strip the archetype
 * and reasoning off every other hook in the list.
 */
export function mergeHookTexts(
  existing: unknown,
  texts: string[],
): ContentHook[] {
  const current = normalizeHooks(existing);
  return texts
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => {
      const previous = current[index];
      return previous && previous.text === text
        ? previous
        : { text, pattern: null, why: null };
    });
}
