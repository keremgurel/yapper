import type { ContentBlock } from "@/lib/db/schema";
import { CANVAS_LIMITS } from "@/lib/content/canvas-actions";

const KINDS = new Set<ContentBlock["kind"]>([
  "paragraph",
  "bullets",
  "steps",
  "script",
]);
/** The whole canvas the model may be shown, in characters. */
const MAX_MATERIAL = 24_000;
const MAX_BLOCKS = 20;

/**
 * The canvas as the client sent it, bounded for the prompt.
 *
 * Unlike the idea expansion parser this keeps unlabelled blocks (a creator
 * may not have named a block yet, and the model still needs to see it at its
 * index) and allows a script-length block, since the script lives here.
 */
export function parseCanvasBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return [];
  let material = 0;
  const blocks: ContentBlock[] = [];
  for (const entry of value.slice(0, MAX_BLOCKS)) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const kind = KINDS.has(raw.kind as ContentBlock["kind"])
      ? (raw.kind as ContentBlock["kind"])
      : "paragraph";
    const label =
      typeof raw.label === "string"
        ? raw.label.trim().slice(0, CANVAS_LIMITS.maxLabel)
        : "";
    const text =
      typeof raw.text === "string"
        ? raw.text.trim().slice(0, CANVAS_LIMITS.maxText)
        : "";
    const items = Array.isArray(raw.items)
      ? raw.items
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, CANVAS_LIMITS.maxItem))
          .filter(Boolean)
          .slice(0, CANVAS_LIMITS.maxItems)
      : [];
    const size = label.length + text.length + items.join("").length;
    if (material + size > MAX_MATERIAL) break;
    material += size;
    blocks.push({
      label,
      kind,
      ...(items.length ? { items } : { text }),
    });
  }
  return blocks;
}
