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
  const sections = e?.sections ?? [];
  const hookSection = sections.find((section) =>
    /hook|opening/i.test(section.label),
  );
  const stepSection = sections.find((section) => section.kind === "steps");
  const scriptSection = sections.find((section) => section.kind === "script");
  const adaptivePoints = sections
    .filter((section) => section.kind === "bullets")
    .flatMap((section) => section.items ?? [])
    .slice(0, 8);

  return {
    title: e?.title || firstLine(idea.originalTranscript) || "Untitled idea",
    hooks: e?.hooks?.length ? e.hooks : (hookSection?.items ?? []),
    points: e?.keyPoints?.length ? e.keyPoints : adaptivePoints,
    example:
      e?.outline?.join("\n") ||
      stepSection?.items?.join("\n") ||
      e?.summary ||
      "",
    cta: "",
    script: e?.script || scriptSection?.text || null,
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
