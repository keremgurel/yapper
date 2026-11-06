import { canUsePremium } from "@/lib/billing/gate";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import type { BrainUsed } from "@/lib/brain/context/types";
import {
  describeCanvasActions,
  keyPointsOnly,
} from "@/lib/content/canvas-actions";
import type { VersionFormat } from "@/lib/content/formats";
import { GENERATE_CREDITS } from "@/lib/db/constants";
import { getContentItem } from "@/lib/db/content";
import {
  appendContentMessages,
  listContentMessages,
  THREAD_CONTEXT,
} from "@/lib/db/content-messages";
import {
  deductCredits,
  getBalance,
  InsufficientCreditsError,
} from "@/lib/db/credits";
import type { ContentBlock } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import {
  askCanvas,
  type CanvasAskInput,
  type CanvasAskResult,
} from "@/lib/generate/canvas";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { guardProviderSpend } from "@/lib/provider-rate-limit";

export const KEY_POINTS_ASK = "Give me the key points as bullets";

export type CanvasItem = NonNullable<
  Awaited<ReturnType<typeof getContentItem>>
>;

/** The piece the writer is shown, already bounded for the prompt. */
export interface CanvasPiece {
  title: string;
  blocks: ContentBlock[];
  hooks: string[];
  format: VersionFormat;
}

/** Entitlement, credits, the idea itself and the provider limits, before any
 * provider work. */
export async function openCanvasAsk(
  request: Request,
  userId: string,
  ideaID: string,
): Promise<OperationResult<CanvasItem>> {
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) return refused(402, "not_entitled");
  if ((await getBalance(userId)) < GENERATE_CREDITS.canvas)
    return refused(402, "insufficient_credits");
  const item = await getContentItem(userId, ideaID);
  if (!item) return refused(404, "not_found");
  if (!process.env.SURPLUS_API_KEY) return refused(501, "no_provider");
  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "generate-canvas",
  );
  if (spendLimited) return refusedBy(spendLimited);
  return succeeded(item);
}

/** The writer's reply for one ask, with the Brain and the idea's thread as
 * context. Nothing is saved or charged here. */
export async function writeOnCanvas(
  userId: string,
  item: CanvasItem,
  piece: CanvasPiece,
  instruction: string,
  target: number | null,
  signal?: AbortSignal,
): Promise<OperationResult<CanvasAskResult & { used: BrainUsed }>> {
  const input: CanvasAskInput = {
    instruction,
    title: piece.title.slice(0, 300),
    blocks: piece.blocks,
    hooks: piece.hooks.slice(0, 8).map((hook) => hook.slice(0, 300)),
    originalNote: item.originalNote.slice(0, 4000) || undefined,
    target:
      target !== null && target >= 0 && target < piece.blocks.length
        ? target
        : null,
    source: {
      title: item.sourceTitle?.slice(0, 200) || null,
      url: item.sourceUrl?.slice(0, 500) || null,
      excerpt:
        (item.sourceTranscript ?? item.sourceSummary ?? "").slice(0, 3000) ||
        null,
    },
    format: piece.format,
  };
  // The ask and the piece together are the routing signal for which skills
  // and sections of the brain should shape the answer.
  const brain = await getBrainContextSafe(userId, {
    surface: "script",
    memoryTask: instruction,
    format: input.format,
    task: [instruction, input.title, input.originalNote]
      .filter(Boolean)
      .join("\n"),
    signal,
  });
  input.context = brain.section;
  const thread = await listContentMessages(userId, item.id, 200);
  input.history = thread
    .slice(-THREAD_CONTEXT)
    .map((line) => ({ role: line.role, text: line.text.slice(0, 1200) }));

  try {
    const result = await askCanvas(input, signal);
    if (instruction === KEY_POINTS_ASK) {
      result.actions = keyPointsOnly(result.actions);
      if (!result.actions.length)
        throw new Error("No key points returned. Your script was kept.");
      result.note = "Added key points. Your script was kept.";
    }
    return succeeded({ ...result, used: brain.used });
  } catch (error) {
    return refused(
      502,
      "generate_failed",
      error instanceof Error ? error.message : "generate_failed",
    );
  }
}

/** Charge the canvas credit and add the exchange to the idea's thread. */
export async function closeCanvasAsk(
  userId: string,
  itemID: string,
  instruction: string,
  result: CanvasAskResult,
): Promise<{
  balance: number;
  messages: Awaited<ReturnType<typeof appendContentMessages>>;
}> {
  // If the deduct races and fails, still deliver; favouring the creator here
  // is a rare, cheap edge case.
  let balance: number;
  try {
    balance = await deductCredits(userId, GENERATE_CREDITS.canvas, {
      metadata: { action: "canvas" },
    });
  } catch (error) {
    if (!(error instanceof InsufficientCreditsError))
      console.error("canvas ask: deduct failed, delivered free", error);
    balance = await getBalance(userId);
  }

  let messages: Awaited<ReturnType<typeof appendContentMessages>> = [];
  try {
    messages = await appendContentMessages(userId, itemID, [
      { role: "creator", text: instruction },
      {
        role: "chirpy",
        text: result.note ?? describeCanvasActions(result.actions),
        actions: result.actions,
      },
    ]);
  } catch (error) {
    // The reply was delivered and paid for; a thread write that fails is a
    // gap in the history, not a reason to fail the ask.
    console.error("canvas ask: thread write failed", error);
  }
  return { balance, messages };
}
