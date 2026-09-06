import type { ContentBlock } from "@/lib/db/schema";
import { isListKind } from "@/lib/content/block-edits";

/**
 * The canvas: an item's body as a list of blocks the creator names and orders.
 *
 * There are no fixed sections. A hook, a script, a list of objections, a
 * beat sheet: each is a block with a label and a kind, and the creator (or
 * Chirpy, on request) decides which ones this piece needs. The one rule is
 * that the first `script` block is what the recorder reads, so it is mirrored
 * into the item's `script` field on every save.
 */
export type CanvasKind = ContentBlock["kind"];

export interface CanvasBlock {
  /** Client-side identity, stable across reorders. Never persisted. */
  id: string;
  label: string;
  kind: CanvasKind;
  text: string;
  items: string[];
}

export const SCRIPT_LABEL = "Script";

let counter = 0;
export function blockId(): string {
  counter += 1;
  return `b${Date.now().toString(36)}${counter}`;
}

export function blockFrom(input: {
  label?: string;
  kind?: CanvasKind;
  text?: string | null;
  items?: string[] | null;
}): CanvasBlock {
  const kind = input.kind ?? "paragraph";
  return {
    id: blockId(),
    label: (input.label ?? "").trim(),
    kind,
    text: input.text ?? "",
    items: (input.items ?? []).map((item) => item.replace(/^\s+/, "")),
  };
}

/**
 * The document for an item. The stored `script` becomes a script block when
 * the body has none, so a script written before the canvas existed shows up
 * where it belongs instead of in a field the canvas cannot see.
 */
export function docFromItem(item: {
  blocks: ContentBlock[];
  script: string | null;
}): CanvasBlock[] {
  const blocks = item.blocks.map((block) => blockFrom(block));
  const script = item.script?.trim();
  if (script && !blocks.some((block) => block.kind === "script")) {
    blocks.unshift(
      blockFrom({ label: SCRIPT_LABEL, kind: "script", text: item.script }),
    );
  }
  return blocks;
}

/** What the recorder will read: the first script block, or nothing. */
export function scriptOf(blocks: CanvasBlock[]): string | null {
  const block = blocks.find((candidate) => candidate.kind === "script");
  const text = block?.text.trim();
  return text ? block!.text : null;
}

/** The persisted shape: blocks without their client ids, plus the mirrored script. */
export function patchFromDoc(blocks: CanvasBlock[]): {
  blocks: ContentBlock[];
  script: string | null;
} {
  return {
    blocks: blocks.map((block) => {
      const stored: ContentBlock = { label: block.label, kind: block.kind };
      if (isListKind(block.kind)) stored.items = block.items;
      else stored.text = block.text;
      return stored;
    }),
    script: scriptOf(blocks),
  };
}

export function updateBlock(
  blocks: CanvasBlock[],
  id: string,
  patch: Partial<Omit<CanvasBlock, "id">>,
): CanvasBlock[] {
  return blocks.map((block) =>
    block.id === id ? { ...block, ...patch } : block,
  );
}

/** Changing kind keeps the words: lines become items and items become lines. */
export function changeKind(
  blocks: CanvasBlock[],
  id: string,
  kind: CanvasKind,
): CanvasBlock[] {
  return blocks.map((block) => {
    if (block.id !== id || block.kind === kind) return block;
    const wasList = isListKind(block.kind);
    const isList = isListKind(kind);
    if (wasList === isList) return { ...block, kind };
    return isList
      ? {
          ...block,
          kind,
          items: block.text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        }
      : { ...block, kind, text: block.items.filter(Boolean).join("\n") };
  });
}

export function moveBlock(
  blocks: CanvasBlock[],
  id: string,
  direction: -1 | 1,
): CanvasBlock[] {
  const index = blocks.findIndex((block) => block.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeBlock(blocks: CanvasBlock[], id: string): CanvasBlock[] {
  return blocks.filter((block) => block.id !== id);
}

export function insertBlockAfter(
  blocks: CanvasBlock[],
  afterId: string | null,
  block: CanvasBlock,
): CanvasBlock[] {
  if (afterId === null) return [block, ...blocks];
  const index = blocks.findIndex((candidate) => candidate.id === afterId);
  if (index < 0) return [...blocks, block];
  return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
}

/** The words in a block, for a search or a prompt. */
export function blockText(block: CanvasBlock): string {
  return isListKind(block.kind) ? block.items.join("\n") : block.text;
}

export function isEmptyBlock(block: CanvasBlock): boolean {
  return !block.label.trim() && !blockText(block).trim();
}
