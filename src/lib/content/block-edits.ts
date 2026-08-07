import type { ContentBlock } from "@/lib/db/schema";

/**
 * Pure edits on an item's flexible body.
 *
 * Kept out of the components so the rules that matter (a block never loses the
 * side it stores its content on, reordering stays in range) can be tested
 * without rendering anything. Every function returns a new array; nothing here
 * mutates its input.
 */

/** Whether this kind stores prose or a list. The editor renders one or the
 * other, and a block must never carry both: `normalizeBlocks` keeps whichever
 * is populated, so holding on to the other side would silently drop it. */
export function isListKind(kind: ContentBlock["kind"]): boolean {
  return kind === "bullets" || kind === "steps";
}

export function emptyBlock(): ContentBlock {
  return { label: "New section", kind: "paragraph", text: "" };
}

export function addBlock(blocks: ContentBlock[]): ContentBlock[] {
  return [...blocks, emptyBlock()];
}

export function removeBlock(
  blocks: ContentBlock[],
  index: number,
): ContentBlock[] {
  return blocks.filter((_, i) => i !== index);
}

export function updateBlock(
  blocks: ContentBlock[],
  index: number,
  patch: Partial<ContentBlock>,
): ContentBlock[] {
  return blocks.map((block, i) =>
    i === index ? { ...block, ...patch } : block,
  );
}

/**
 * Change a block's kind, carrying its content across the prose/list divide
 * rather than discarding it: prose splits on newlines into items, and items
 * join back into lines. Switching kind twice is therefore close to lossless,
 * which is what makes the control safe to click while exploring a shape.
 */
export function changeBlockKind(
  blocks: ContentBlock[],
  index: number,
  kind: ContentBlock["kind"],
): ContentBlock[] {
  return blocks.map((block, i) => {
    if (i !== index) return block;
    const wasList = isListKind(block.kind);
    const nowList = isListKind(kind);
    if (wasList === nowList) return { ...block, kind };
    return nowList
      ? {
          label: block.label,
          kind,
          items: (block.text ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        }
      : { label: block.label, kind, text: (block.items ?? []).join("\n") };
  });
}

/** Move a block one slot up or down. Out-of-range moves are a no-op, so the
 * caller can wire the buttons without guarding the ends itself. */
export function moveBlock(
  blocks: ContentBlock[],
  index: number,
  direction: -1 | 1,
): ContentBlock[] {
  const target = index + direction;
  if (index < 0 || index >= blocks.length) return blocks;
  if (target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
