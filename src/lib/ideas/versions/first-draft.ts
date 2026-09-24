import type { IdeaExpansion, IdeaInput } from "@/lib/ideas/types";
import type { IdeaMaterial, WrittenVersion } from "./prompt";
import { DEK_LABEL, KEY_POINTS_LABEL } from "./stored";

/**
 * A long-form or article first draft, straight from the composer, reuses the
 * short-form draft's plumbing: the same input in, the same expansion shape out,
 * so every client saves it the way it already saves a draft.
 */

export function materialFromInput(input: IdeaInput): IdeaMaterial {
  const words = input.transcript?.trim() ?? "";
  return {
    title:
      input.source?.title?.trim() ||
      words.split(/\s+/).slice(0, 8).join(" ") ||
      "Untitled idea",
    note: words || null,
    sourceTitle: input.source?.title ?? null,
    sourceUrl: input.source?.url ?? input.url ?? null,
    sourceTranscript: input.source?.transcript ?? null,
    sourceSummary: input.source?.summary ?? null,
  };
}

export function expansionFromVersion(written: WrittenVersion): IdeaExpansion {
  const sections: NonNullable<IdeaExpansion["sections"]> = [];
  if (written.dek)
    sections.push({ label: DEK_LABEL, kind: "paragraph", text: written.dek });
  if (written.keyPoints.length) {
    sections.push({
      label: KEY_POINTS_LABEL,
      kind: "bullets",
      items: written.keyPoints,
    });
  }
  return {
    title: written.title,
    pillar: written.pillar,
    summary: written.summary ?? undefined,
    hooks: written.alternatives,
    script: written.script,
    sections,
  };
}
