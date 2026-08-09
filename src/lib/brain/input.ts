import type { BrainBlockInput } from "@/lib/db/project-brain";
import { brainBlockKinds, type BrainBlockKind } from "@/lib/db/schema";

// Generous enough to hold a creator thinking properly, bounded so a client
// cannot stuff megabytes into a row. The context block truncates again, much
// harder, on its way into a prompt.
const TITLE_MAX = 80;
const BODY_MAX = 4000;
const ITEM_MAX = 400;
const ITEMS_MAX = 60;

const isKind = (v: unknown): v is BrainBlockKind =>
  typeof v === "string" && (brainBlockKinds as readonly string[]).includes(v);

/**
 * A client payload turned into a safe block.
 *
 * Absent keys stay absent rather than becoming empty strings: that is what lets
 * a page save one field at a time without blanking the rest of the block.
 */
export function parseBrainBlockInput(
  body: Record<string, unknown>,
): Partial<BrainBlockInput> {
  const input: Partial<BrainBlockInput> = {};

  if (typeof body.title === "string") {
    input.title = body.title.trim().slice(0, TITLE_MAX);
  }
  if (isKind(body.kind)) input.kind = body.kind;
  if (typeof body.body === "string") input.body = body.body.slice(0, BODY_MAX);
  if (Array.isArray(body.items)) {
    input.items = body.items
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, ITEM_MAX))
      .filter(Boolean)
      .slice(0, ITEMS_MAX);
  }
  if (typeof body.inContext === "boolean") input.inContext = body.inContext;

  return input;
}

/** A block being created needs a title; everything else can come later. */
export function parseNewBrainBlock(
  body: Record<string, unknown>,
): BrainBlockInput | null {
  const input = parseBrainBlockInput(body);
  if (!input.title) return null;
  return { ...input, title: input.title };
}

/** An explicit order from the client, as a list of ids. */
export function parseBlockOrder(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((id): id is string => typeof id === "string")
    .slice(0, 200);
  return ids.length ? ids : null;
}
