import { hookTexts } from "@/lib/content/normalize";
import type { ContentBase } from "@/lib/content/rebase";
import type { ContentBlock } from "@/lib/db/schema";

/**
 * The client half of a merged save (see rebaseOnto): which stored copy each
 * edited field started from, sent as `base`, and what to do with the reply.
 */
const KEYS = ["title", "script", "hooks", "blocks"] as const;
type Key = (typeof KEYS)[number];

interface Fields {
  title?: string | null;
  script?: string | null;
  hooks?: unknown;
  blocks?: ContentBlock[];
}

function value(fields: Fields, key: Key): ContentBase[Key] {
  if (key === "hooks") return hookTexts(fields.hooks);
  // In one key order, since the server's copy comes back from jsonb.
  if (key === "blocks")
    return fields.blocks?.map(({ label, kind, text, items }) => ({
      label,
      kind,
      ...(text !== undefined ? { text } : {}),
      ...(items !== undefined ? { items } : {}),
    }));
  return fields[key];
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** The base of every field a record has, as the server stores it. */
export function baseOf(record: Fields): ContentBase {
  const base: ContentBase = {};
  for (const key of KEYS)
    if (record[key] !== undefined)
      (base as Record<Key, unknown>)[key] = value(record, key);
  return base;
}

/** The base for the fields a patch sends. */
export function baseFor(patch: Fields, base: ContentBase): ContentBase {
  const picked: ContentBase = {};
  for (const key of KEYS)
    if (patch[key] !== undefined && base[key] !== undefined)
      (picked as Record<Key, unknown>)[key] = base[key];
  return picked;
}

/**
 * After a save: the base for the next one, and the saved fields to show
 * instead of the client's. A merged save is shown only for fields the
 * creator has not touched since it was sent; their newer typing is sent
 * next with the sent copy as its base, so the server merges it again.
 */
export function afterSave(args: {
  base: ContentBase;
  sent: Fields;
  saved: Fields;
  latest: Fields;
  rebased: boolean;
}): { base: ContentBase; show: ContentBase } {
  const base = { ...args.base };
  const show: ContentBase = {};
  for (const key of KEYS) {
    if (args.sent[key] === undefined) continue;
    const saved = value(args.saved, key);
    const untouched = same(value(args.latest, key), value(args.sent, key));
    if (!args.rebased || untouched) (base as Record<Key, unknown>)[key] = saved;
    else (base as Record<Key, unknown>)[key] = value(args.sent, key);
    if (args.rebased && untouched && !same(saved, value(args.sent, key)))
      (show as Record<Key, unknown>)[key] = saved;
  }
  return { base, show };
}
