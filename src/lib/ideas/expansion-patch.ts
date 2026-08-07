import type { ContentBlock } from "@/lib/db/schema";
import type {
  IdeaExpansion,
  IdeaExpansionSection,
  IdeaSource,
} from "@/lib/ideas/types";

/**
 * Map an AI expansion onto the item's stored fields.
 *
 * This is the function that replaces `ideaToContentPatch`. The old one squeezed
 * the model's reference-specific sections into fixed `points` / `example` / `cta`
 * columns and dropped whatever did not fit. This one stores the sections as they
 * are, so the shape the model chose for THIS reference survives all the way to
 * the library.
 *
 * `originalNote` is never touched here: the creator's exact words are not the
 * AI's to rewrite.
 */
export interface ExpansionPatch {
  title?: string;
  blocks: ContentBlock[];
  format: string | null;
  summary: string | null;
  hooks: { text: string; pattern: null; why: null }[];
  script?: string | null;
  pillar?: string | null;
}

/**
 * Adaptive sections as they are stored. Shared by every generator that returns
 * a chosen-per-idea body, so there is exactly one place that decides what a
 * section becomes on disk.
 */
export function sectionsToBlocks(
  sections: readonly IdeaExpansionSection[] = [],
): ContentBlock[] {
  return sections
    .filter((s) => s.text?.trim() || s.items?.length)
    .map((s) => ({
      label: s.label,
      kind: s.kind,
      ...(s.text?.trim() ? { text: s.text.trim() } : {}),
      ...(s.items?.length ? { items: s.items } : {}),
    }));
}

export function expansionToPatch(expansion: IdeaExpansion): ExpansionPatch {
  const blocks = sectionsToBlocks(expansion.sections);

  // Older expansions predate adaptive sections and only have the fixed fields.
  // They become blocks too, so every idea ends up with one body model.
  if (!blocks.length) {
    if (expansion.keyPoints?.length) {
      blocks.push({
        label: "Key points",
        kind: "bullets",
        items: expansion.keyPoints,
      });
    }
    if (expansion.outline?.length) {
      blocks.push({
        label: "Outline",
        kind: "steps",
        items: expansion.outline,
      });
    }
  }

  const script =
    expansion.script?.trim() ||
    (expansion.sections ?? []).find((s) => s.kind === "script")?.text?.trim() ||
    null;

  return {
    title: expansion.title || undefined,
    blocks,
    format: expansion.format ?? null,
    summary: expansion.summary ?? null,
    // Hooks from an expansion carry no pattern attribution; the hook engine is
    // what assigns those, and claiming one here would be a lie.
    hooks: (expansion.hooks ?? []).map((text) => ({
      text,
      pattern: null,
      why: null,
    })),
    script,
    pillar: expansion.pillar ?? null,
  };
}

/** Map a resolved reference onto the item's source columns, including the
 * verbatim transcript that used to live only in the browser. */
export function sourceToPatch(source: IdeaSource) {
  const hasTranscript = Boolean(source.transcript?.trim());
  return {
    sourceUrl: source.url,
    sourceTitle: source.title ?? null,
    sourceTranscript: source.transcript ?? null,
    sourceSummary: source.summary ?? null,
    sourceReferenceType: source.referenceType ?? null,
    sourcePlatform: source.platform ?? null,
    // Reported honestly: a reference we could not hear is `needs_media`, not a
    // silent downgrade to "this was always an article".
    transcriptStatus: hasTranscript
      ? ("ready" as const)
      : source.summary?.trim()
        ? ("unavailable" as const)
        : ("needs_media" as const),
  };
}
