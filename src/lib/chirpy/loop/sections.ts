import { record } from "../protocol";

/**
 * Splits the project context the Mac app sends into what goes in the prompt
 * and what the model reads on demand. Small sections are inlined smallest
 * first until the budget runs out; the largest (the transcript, timeline
 * items, saved audio) are withheld and listed with their sizes, so a short
 * project plans in one call and a long one stops paying for its whole
 * transcript on every turn.
 */
/** Sections this small always go inline: reading them would cost more. */
export const SMALL_SECTION_BYTES = 600;
const READ_RESULT_BYTES = 12_000;
const SELECTION_KEYS = [
  "selectedClipIDs",
  "selectedCaptionIDs",
  "selectedOverlayIDs",
  "selectedOverlayID",
];

export interface SplitContext {
  overview: Record<string, unknown>;
  withheld: Record<string, unknown>;
}

function size(value: unknown): number {
  return JSON.stringify(value)?.length ?? 0;
}

function selectedIDs(context: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  for (const key of SELECTION_KEYS) {
    const value = context[key];
    for (const id of Array.isArray(value) ? value : [value])
      if (typeof id === "string") ids.add(id.toLowerCase());
  }
  return ids;
}

function itemID(item: unknown): string | null {
  return record(item) && typeof item.id === "string"
    ? item.id.toLowerCase()
    : null;
}

export function splitContext(
  context: Record<string, unknown>,
  inlineBudgetBytes: number,
  smallSectionBytes = SMALL_SECTION_BYTES,
): SplitContext {
  const overview: Record<string, unknown> = {};
  const withheld: Record<string, unknown> = {};
  let budget = inlineBudgetBytes;
  const entries = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({ key, value, bytes: size(value) }))
    .sort((a, b) => a.bytes - b.bytes);
  for (const { key, value, bytes } of entries) {
    if (bytes <= smallSectionBytes || bytes <= budget) {
      overview[key] = value;
      if (bytes > smallSectionBytes) budget -= bytes;
    } else {
      withheld[key] = value;
    }
  }
  const selection = selectedIDs(context);
  const selected: Record<string, unknown[]> = {};
  const listing = Object.entries(withheld).map(([section, value]) => {
    if (Array.isArray(value)) {
      const picked = value.filter((item) => {
        const id = itemID(item);
        return id !== null && selection.has(id);
      });
      if (picked.length) selected[section] = picked;
      return { section, items: value.length, bytes: size(value) };
    }
    return { section, bytes: size(value) };
  });
  if (listing.length) overview.withheldSections = listing;
  if (Object.keys(selected).length) overview.selectedFromWithheld = selected;
  return { overview, withheld };
}

function overlaps(item: unknown, from?: number, to?: number): boolean {
  if (from === undefined && to === undefined) return true;
  if (!record(item)) return false;
  const start = Number(item.start ?? item.time);
  const end = Number(item.end ?? item.time);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return true;
  return end >= (from ?? -Infinity) && start <= (to ?? Infinity);
}

/** One page of a section, filtered by IDs and a timeline window. */
export function readSection(
  context: Record<string, unknown>,
  query: {
    section: string;
    ids?: string[];
    from?: number;
    to?: number;
    offset?: number;
  },
): unknown {
  if (!Object.hasOwn(context, query.section))
    return { error: `No section named ${query.section}.` };
  const value = context[query.section];
  if (!Array.isArray(value)) {
    const text = JSON.stringify(value);
    return text.length <= READ_RESULT_BYTES
      ? { section: query.section, value }
      : {
          section: query.section,
          truncated: true,
          value: text.slice(0, READ_RESULT_BYTES),
        };
  }
  const ids = query.ids?.length
    ? new Set(query.ids.map((id) => id.toLowerCase()))
    : null;
  const matches = value.filter(
    (item) =>
      (!ids || ids.has(itemID(item) ?? "")) &&
      overlaps(item, query.from, query.to),
  );
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const items: unknown[] = [];
  let bytes = 0;
  for (const item of matches.slice(offset)) {
    bytes += size(item) + 1;
    if (items.length && bytes > READ_RESULT_BYTES) break;
    items.push(item);
  }
  return {
    section: query.section,
    total: matches.length,
    offset,
    items,
    nextOffset:
      offset + items.length < matches.length
        ? offset + items.length
        : undefined,
  };
}
