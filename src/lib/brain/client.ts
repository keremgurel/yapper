import type { AskMessage, AskReply, BlockSuggestion } from "@/lib/brain/ask";
import type { SpunIdea } from "@/lib/brain/spin";
import type { BrainBlockKind } from "@/lib/db/schema";

/** One section of the brain, as the page sees it. */
export interface BrainBlock {
  id: string;
  title: string;
  kind: BrainBlockKind;
  body: string;
  items: string[];
  inContext: boolean;
  sortOrder: number;
}

export type BrainBlockPatch = Partial<
  Pick<BrainBlock, "title" | "kind" | "body" | "items" | "inContext">
>;

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

export async function createBlock(
  block: BrainBlockPatch & { title: string },
): Promise<BrainBlock> {
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

/** Pull the handle. `pillar` holds one reel still. */
export async function spin(pillar?: string | null): Promise<SpunIdea> {
  const data = await json<{ idea: SpunIdea }>(
    await fetch("/api/brain/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pillar: pillar ?? null }),
    }),
  );
  return data.idea;
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

export type { AskMessage, AskReply, BlockSuggestion, SpunIdea };
