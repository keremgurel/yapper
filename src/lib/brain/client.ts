import type { AskMessage, AskReply, BlockSuggestion } from "@/lib/brain/ask";
import type { SpunIdea } from "@/lib/brain/spin";
import type { BrainUsed } from "@/lib/brain/context/types";
import type {
  BrainBlockKind,
  BrainBlockUsage,
  BrainTable,
} from "@/lib/db/schema";

/** One section of the brain, as the page sees it. */
export interface BrainBlock {
  id: string;
  title: string;
  kind: BrainBlockKind;
  body: string;
  items: string[];
  rows: BrainTable | null;
  /** The one line that is always in the prompt. */
  digest: string;
  usage: BrainBlockUsage;
  tags: string[];
  sourceLabel: string;
  sourceUrl: string;
  /** Size of the contents, for the budget meter. Server-derived. */
  charCount: number;
  sortOrder: number;
}

export type BrainBlockPatch = Partial<
  Pick<
    BrainBlock,
    | "title"
    | "kind"
    | "body"
    | "items"
    | "rows"
    | "digest"
    | "usage"
    | "tags"
    | "sourceLabel"
    | "sourceUrl"
  >
>;

/** A section as it is created: a title is required, everything else optional. */
export type NewBrainBlock = BrainBlockPatch & { title: string };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`brain_api_${res.status}`);
  return (await res.json()) as T;
}

export async function listBlocks(): Promise<BrainBlock[]> {
  const data = await json<{ blocks: BrainBlock[] }>(
    await fetch("/api/brain/blocks"),
  );
  return data.blocks;
}

export async function createBlock(block: NewBrainBlock): Promise<BrainBlock> {
  const data = await json<{ block: BrainBlock }>(
    await fetch("/api/brain/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(block),
    }),
  );
  return data.block;
}

/** `keepalive` lets a final autosave flush survive a hard navigation. */
export async function patchBlock(
  id: string,
  patch: BrainBlockPatch,
  opts: { keepalive?: boolean } = {},
): Promise<BrainBlock> {
  const data = await json<{ block: BrainBlock }>(
    await fetch(`/api/brain/blocks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      keepalive: opts.keepalive,
    }),
  );
  return data.block;
}

export async function deleteBlock(id: string): Promise<void> {
  await json<{ ok: true }>(
    await fetch(`/api/brain/blocks/${id}`, { method: "DELETE" }),
  );
}

export async function reorderBlocks(order: string[]): Promise<BrainBlock[]> {
  const data = await json<{ blocks: BrainBlock[] }>(
    await fetch("/api/brain/blocks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    }),
  );
  return data.blocks;
}

/** Pull the handle. `pillar` holds one reel still. `used` names what the brain
 * contributed, so the card can say so. */
export async function spin(
  pillar?: string | null,
): Promise<{ idea: SpunIdea; used: BrainUsed | null }> {
  const data = await json<{ idea: SpunIdea; used?: BrainUsed }>(
    await fetch("/api/brain/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pillar: pillar ?? null }),
    }),
  );
  return { idea: data.idea, used: data.used ?? null };
}

export async function ask(messages: AskMessage[]): Promise<AskReply> {
  return json<AskReply>(
    await fetch("/api/brain/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    }),
  );
}

export type { AskMessage, AskReply, BlockSuggestion, BrainUsed, SpunIdea };
