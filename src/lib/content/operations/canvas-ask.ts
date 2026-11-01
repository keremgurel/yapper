import { canUsePremium } from "@/lib/billing/gate";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import type { BrainUsed } from "@/lib/brain/context/types";
import {
  applyCanvasActions,
  blocksForRequest,
  describeCanvasActions,
  keyPointsOnly,
} from "@/lib/content/canvas-actions";
import { parseCanvasBlocks } from "@/lib/content/canvas-request";
import { isVersionFormat, type VersionFormat } from "@/lib/content/formats";
import {
  readCanvasDocument,
  saveCanvasDocument,
} from "@/lib/content/operations/canvas-document";
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

export interface IdeaCanvasAsk {
  ideaID: string;
  instruction: string;
  /** The version being asked about; the idea's lead when absent. */
  format?: VersionFormat;
  /** The block the ask is aimed at, by index. */
  target?: number | null;
}

export interface IdeaCanvasAnswer extends CanvasAskResult {
  balance: number;
  used: BrainUsed;
  /** The exchange as saved to the idea's thread; empty if that write failed. */
  messages: Awaited<ReturnType<typeof appendContentMessages>>;
}

/**
 * One ask on an idea's canvas: "write the script", "give me five hooks",
 * "make block 2 punchier". The document is read from the database, the
 * reply's actions are applied and saved here, then the exchange joins the
 * idea's thread. The canvas ask bar on web and Mac and Chirpy's
 * studio.ideas.canvasEdit all land here, so the same ask leaves the same
 * document. Credits are charged only once the edit is saved.
 */
export async function askIdeaCanvas(
  request: Request,
  userId: string,
  ask: IdeaCanvasAsk,
  signal?: AbortSignal,
): Promise<OperationResult<IdeaCanvasAnswer>> {
  const instruction = ask.instruction.trim().slice(0, 600);
  if (!instruction) return refused(400, "bad_request");

  const cost = GENERATE_CREDITS.canvas;
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) return refused(402, "not_entitled");
  if ((await getBalance(userId)) < cost)
    return refused(402, "insufficient_credits");
  const item = await getContentItem(userId, ask.ideaID);
  if (!item) return refused(404, "not_found");
  if (!process.env.SURPLUS_API_KEY) return refused(501, "no_provider");

  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "generate-canvas",
  );
  if (spendLimited) return refusedBy(spendLimited);

  const lead = isVersionFormat(item.leadFormat) ? item.leadFormat : "short";
  const document = await readCanvasDocument(userId, item, ask.format ?? lead);
  // Bounded exactly as a client's copy was: this is the biggest lever on
  // token cost.
  const blocks = parseCanvasBlocks(blocksForRequest(document.blocks));
  const target =
    ask.target != null && ask.target >= 0 && ask.target < blocks.length
      ? ask.target
      : null;
  const input: CanvasAskInput = {
    instruction,
    title: document.title.slice(0, 300),
    blocks,
    hooks: document.hooks.slice(0, 8).map((hook) => hook.slice(0, 300)),
    originalNote: item.originalNote.slice(0, 4000) || undefined,
    target,
    source: {
      title: item.sourceTitle?.slice(0, 200) || null,
      url: item.sourceUrl?.slice(0, 500) || null,
      excerpt:
        (item.sourceTranscript ?? item.sourceSummary ?? "").slice(0, 3000) ||
        null,
    },
    format: document.format,
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

  let result: CanvasAskResult;
  try {
    result = await askCanvas(input, signal);
    if (instruction === KEY_POINTS_ASK) {
      result.actions = keyPointsOnly(result.actions);
      if (!result.actions.length)
        throw new Error("No key points returned. Your script was kept.");
      result.note = "Added key points. Your script was kept.";
    }
  } catch (error) {
    return refused(
      502,
      "generate_failed",
      error instanceof Error ? error.message : "generate_failed",
    );
  }

  const saved = await saveCanvasDocument(
    userId,
    document,
    applyCanvasActions(document, result.actions),
  );
  if (!saved.ok) return saved;

  // If the deduct races and fails, still deliver; favouring the creator here
  // is a rare, cheap edge case.
  let balance: number;
  try {
    balance = await deductCredits(userId, cost, {
      metadata: { action: "canvas" },
    });
  } catch (error) {
    if (!(error instanceof InsufficientCreditsError))
      console.error("canvas ask: deduct failed, delivered free", error);
    balance = await getBalance(userId);
  }

  let messages: IdeaCanvasAnswer["messages"] = [];
  try {
    messages = await appendContentMessages(userId, item.id, [
      { role: "creator", text: instruction },
      {
        role: "chirpy",
        text: result.note ?? describeCanvasActions(result.actions),
        actions: result.actions,
      },
    ]);
  } catch (error) {
    // The edit was saved and paid for; a thread write that fails is a gap in
    // the history, not a reason to fail the ask.
    console.error("canvas ask: thread write failed", error);
  }

  return succeeded({ ...result, balance, used: brain.used, messages });
}
