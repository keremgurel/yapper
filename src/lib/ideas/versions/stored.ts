import type { VersionFormat } from "@/lib/content/formats";
import { hookTexts, normalizeBlocks } from "@/lib/content/normalize";
import type { ContentVersionInput } from "@/lib/content/version-input";
import type { ContentBlock } from "@/lib/db/schema";
import type { IdeaMaterial, VersionSource, WrittenVersion } from "./prompt";

/**
 * Between what the database stores and what the version writer reads and
 * returns. An idea's lead lives on the item row and every other version in
 * `content_versions`; both hold the same fields, so one reader covers both.
 */

interface StoredBody {
  title?: string | null;
  hooks: unknown;
  blocks: unknown;
  script?: string | null;
}

export const KEY_POINTS_LABEL = "Key points";
export const DEK_LABEL = "Dek";

function keyPoints(blocks: ContentBlock[]): string[] {
  const block =
    blocks.find((b) => b.label === KEY_POINTS_LABEL && b.items?.length) ??
    blocks.find((b) => b.kind === "bullets" && b.items?.length);
  return block?.items ?? [];
}

/** The script text: the column when set, else the first script block. */
function scriptOf(body: StoredBody, blocks: ContentBlock[]): string {
  const column = body.script?.trim();
  if (column) return column;
  return blocks.find((b) => b.kind === "script")?.text?.trim() ?? "";
}

export function versionSource(
  format: VersionFormat,
  body: StoredBody,
): VersionSource {
  const blocks = normalizeBlocks(body.blocks);
  return {
    format,
    title: body.title?.trim() || null,
    alternatives: hookTexts(body.hooks),
    script: scriptOf(body, blocks),
    keyPoints: keyPoints(blocks),
  };
}

export function ideaMaterial(item: {
  title: string;
  originalNote?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  sourceTranscript?: string | null;
  sourceSummary?: string | null;
  recordedTranscript?: string | null;
}): IdeaMaterial {
  return {
    title: item.title,
    note: item.originalNote,
    sourceTitle: item.sourceTitle,
    sourceUrl: item.sourceUrl,
    sourceTranscript: item.sourceTranscript,
    sourceSummary: item.sourceSummary,
    recordedTranscript: item.recordedTranscript,
  };
}

/** A written version as a `content_versions` row body. */
export function versionInput(
  written: WrittenVersion,
  writtenFrom: VersionFormat | null,
): ContentVersionInput {
  const blocks: ContentBlock[] = [];
  if (written.dek)
    blocks.push({ label: DEK_LABEL, kind: "paragraph", text: written.dek });
  if (written.keyPoints.length) {
    blocks.push({
      label: KEY_POINTS_LABEL,
      kind: "bullets",
      items: written.keyPoints,
    });
  }
  return {
    title: written.title,
    hooks: written.alternatives.map((text) => ({
      text,
      pattern: null,
      why: null,
    })),
    blocks,
    script: written.script,
    writtenFrom,
  };
}
