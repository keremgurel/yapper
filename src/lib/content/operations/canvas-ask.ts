import type { BrainUsed } from "@/lib/brain/context/types";
import {
  applyCanvasActions,
  blocksForRequest,
} from "@/lib/content/canvas-actions";
import { parseCanvasBlocks } from "@/lib/content/canvas-request";
import { isVersionFormat, type VersionFormat } from "@/lib/content/formats";
import {
  closeCanvasAsk,
  openCanvasAsk,
  writeOnCanvas,
  type CanvasPiece,
} from "@/lib/content/operations/canvas-ask-steps";
import {
  readCanvasDocument,
  saveCanvasDocument,
  savedDocument,
} from "@/lib/content/operations/canvas-document";
import type { CanvasAskResult } from "@/lib/generate/canvas";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

export { KEY_POINTS_ASK } from "@/lib/content/operations/canvas-ask-steps";

export interface IdeaCanvasAsk {
  ideaID: string;
  instruction: string;
  /** The version being asked about; the idea's lead when absent. */
  format?: VersionFormat;
  /** The block the ask is aimed at, by index. */
  target?: number | null;
}

export interface CanvasAnswer extends CanvasAskResult {
  balance: number;
  used: BrainUsed;
  /** The exchange as saved to the idea's thread; empty if that write failed. */
  messages: Awaited<ReturnType<typeof closeCanvasAsk>>["messages"];
}

export interface IdeaCanvasAnswer extends CanvasAnswer {
  /** The version as saved, for the client's next autosave `base`. */
  document: ReturnType<typeof savedDocument>;
}

const cleanInstruction = (value: string) => value.trim().slice(0, 600);

/**
 * One ask on an idea's canvas: "write the script", "give me five hooks",
 * "make block 2 punchier". The document is read from the database, the
 * reply's actions are applied and saved here, then the exchange joins the
 * idea's thread. The canvas ask bar on web and Mac and Chirpy's
 * studio.ideas.canvasEdit all land here, so the same ask leaves the same
 * document. If the creator saved an edit while the writer worked, nothing is
 * saved or charged (409 changed_while_working). Credits are charged only
 * once the edit is saved.
 */
export async function askIdeaCanvas(
  request: Request,
  userId: string,
  ask: IdeaCanvasAsk,
  signal?: AbortSignal,
): Promise<OperationResult<IdeaCanvasAnswer>> {
  const instruction = cleanInstruction(ask.instruction);
  if (!instruction) return refused(400, "bad_request");
  const opened = await openCanvasAsk(request, userId, ask.ideaID);
  if (!opened.ok) return opened;
  const item = opened.value;

  const lead = isVersionFormat(item.leadFormat) ? item.leadFormat : "short";
  const document = await readCanvasDocument(userId, item, ask.format ?? lead);
  // Bounded exactly as a client's copy was: this is the biggest lever on
  // token cost.
  const piece: CanvasPiece = {
    title: document.title,
    blocks: parseCanvasBlocks(blocksForRequest(document.blocks)),
    hooks: document.hooks,
    format: document.format,
  };
  const written = await writeOnCanvas(
    userId,
    item,
    piece,
    instruction,
    ask.target ?? null,
    signal,
  );
  if (!written.ok) return written;
  const { used, ...result } = written.value;

  const after = applyCanvasActions(document, result.actions);
  const saved = await saveCanvasDocument(userId, document, after);
  if (!saved.ok) return saved;
  const closed = await closeCanvasAsk(userId, item.id, instruction, result);
  return succeeded({
    ...result,
    ...closed,
    used,
    document: savedDocument(document, after),
  });
}

/**
 * The same ask for a client that applies the reply and autosaves it itself:
 * Mac builds installed before the server saved asks. The writer sees the
 * piece the client sent and nothing is written but the thread, as before.
 */
export async function askCanvasAsSent(
  request: Request,
  userId: string,
  ask: IdeaCanvasAsk & { piece: Omit<CanvasPiece, "format"> },
  signal?: AbortSignal,
): Promise<OperationResult<CanvasAnswer>> {
  const instruction = cleanInstruction(ask.instruction);
  if (!instruction) return refused(400, "bad_request");
  const opened = await openCanvasAsk(request, userId, ask.ideaID);
  if (!opened.ok) return opened;
  const item = opened.value;
  const written = await writeOnCanvas(
    userId,
    item,
    { ...ask.piece, format: ask.format ?? "short" },
    instruction,
    ask.target ?? null,
    signal,
  );
  if (!written.ok) return written;
  const { used, ...result } = written.value;
  const closed = await closeCanvasAsk(userId, item.id, instruction, result);
  return succeeded({ ...result, ...closed, used });
}
