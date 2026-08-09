import type { BrainBlockKind } from "@/lib/db/schema";

/** The shape both the server rows and the client objects share. */
interface BlockLike {
  title: string;
  kind: BrainBlockKind;
  body: string;
  items: string[];
}

/**
 * The formats the creator has written down, for the slot machine's third reel.
 *
 * Found by the block's title rather than by a dedicated column, because the
 * brain is the creator's page: they can call it "Formats", "Shapes I shoot" or
 * "What actually works on camera", and none of those should have to be the one
 * we guessed. A missing block is not a problem; the reel falls back to the
 * general ones.
 */
export function formatsIn(blocks: BlockLike[]): string[] {
  const block = blocks.find((candidate) =>
    /format|shape|structure/i.test(candidate.title),
  );
  if (!block) return [];
  const lines = block.items.length
    ? block.items
    : block.body.split("\n").map((line) => line.replace(/^[-*•]\s*/, ""));
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
