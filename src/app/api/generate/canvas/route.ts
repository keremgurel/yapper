import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { canUsePremium } from "@/lib/billing/gate";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import { GENERATE_CREDITS } from "@/lib/db/constants";
import {
  deductCredits,
  getBalance,
  InsufficientCreditsError,
} from "@/lib/db/credits";
import { ensureUser } from "@/lib/db/users";
import { askCanvas, type CanvasAskInput } from "@/lib/generate/canvas";
import { parseCanvasBlocks } from "@/lib/content/canvas-request";
import {
  appendContentMessages,
  listContentMessages,
  THREAD_CONTEXT,
} from "@/lib/db/content-messages";
import { getContentItem } from "@/lib/db/content";
import { describeCanvasActions } from "@/lib/content/canvas-actions";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const str = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const strArr = (value: unknown, max: number, cap: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((x): x is string => typeof x === "string" && !!x.trim())
        .slice(0, cap)
        .map((x) => x.slice(0, max))
    : [];

/**
 * One ask on the canvas: "write the script", "give me five hooks", "add a
 * section on objections", "make block 2 punchier". Auth, then credits charged
 * only on a usable reply, like the other generate routes.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const cost = GENERATE_CREDITS.canvas;
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    return Response.json({ error: "not_entitled" }, { status: 402 });
  }
  if ((await getBalance(userId)) < cost) {
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const instruction = str(body.instruction, 600);
  if (!instruction) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const target = Number.isInteger(body.target) ? (body.target as number) : null;
  // The idea this ask belongs to. Optional for older clients; when present the
  // thread is read for context and the exchange is written back to it.
  const contentId =
    typeof body.contentId === "string" &&
    /^[0-9a-f-]{36}$/i.test(body.contentId)
      ? body.contentId
      : null;
  if (contentId && !(await getContentItem(userId, contentId))) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const source =
    body.source && typeof body.source === "object"
      ? (body.source as Record<string, unknown>)
      : {};
  const input: CanvasAskInput = {
    instruction,
    title: str(body.title, 300),
    // Bounded on the way in: the body is client supplied, so it is also the
    // biggest lever on token cost here.
    blocks: parseCanvasBlocks(body.blocks),
    hooks: strArr(body.hooks, 300, 8),
    originalNote: str(body.originalNote, 4000) || undefined,
    target: target !== null && target >= 0 && target < 20 ? target : null,
    source: {
      title: str(source.title, 200) || null,
      url: str(source.url, 500) || null,
      excerpt: str(source.excerpt, 3000) || null,
    },
  };
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }

  const spendLimited = await guardProviderSpend(req, userId, "generate-canvas");
  if (spendLimited) return spendLimited;

  // The ask and the piece together are the routing signal for which skills
  // and sections of the brain should shape the answer.
  const brain = await getBrainContextSafe(userId, {
    surface: "script",
    task: [instruction, input.title, input.originalNote]
      .filter(Boolean)
      .join("\n"),
    signal: req.signal,
  });
  input.context = brain.section;
  if (contentId) {
    const thread = await listContentMessages(userId, contentId, 200);
    input.history = thread
      .slice(-THREAD_CONTEXT)
      .map((line) => ({ role: line.role, text: line.text.slice(0, 1200) }));
  }

  let result;
  try {
    result = await askCanvas(input, req.signal);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "generate_failed";
    return Response.json({ error: "generate_failed", detail }, { status: 502 });
  }

  // Charge only now that there is a result. If the deduct races and fails,
  // still deliver; favouring the creator here is a rare, cheap edge case.
  let balance: number;
  try {
    balance = await deductCredits(userId, cost, {
      metadata: { action: "canvas" },
    });
  } catch (error) {
    if (!(error instanceof InsufficientCreditsError)) {
      console.error("canvas ask: deduct failed, delivered free", error);
    }
    balance = await getBalance(userId);
  }

  let messages: {
    id: string;
    role: string;
    text: string;
    actions: unknown[];
    createdAt: Date;
  }[] = [];
  if (contentId) {
    try {
      messages = await appendContentMessages(userId, contentId, [
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
  }

  return Response.json({ ...result, balance, used: brain.used, messages });
}
