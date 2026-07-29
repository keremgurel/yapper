import type { ContentPatch } from "@/lib/content/client";
import type { Idea } from "@/lib/ideas/types";

/**
 * Map a curated idea onto a new Content Library item. Curating is the moment an
 * idea graduates from the bank into the pipeline you actually shoot, so it lands
 * as a `drafted` library item carrying the expansion the AI already built. The
 * original transcript and outline stay on the idea in the bank for reference.
 */
export function ideaToContentPatch(idea: Idea): ContentPatch {
  const e = idea.expansion;
  return {
    title: e?.title || firstLine(idea.originalTranscript) || "Untitled idea",
    hooks: e?.hooks ?? [],
    points: e?.keyPoints ?? [],
    example: e?.outline?.join("\n") ?? "",
    cta: "",
    script: e?.script ?? null,
    status: "drafted",
    pillar: e?.pillar ?? null,
    sourceUrl: idea.source?.url,
    sourceTitle: idea.source?.title,
  };
}

function firstLine(s: string): string {
  const line = s.split(/[.\n]/)[0]?.trim() ?? "";
  return line.length > 80 ? line.slice(0, 80) : line;
}
