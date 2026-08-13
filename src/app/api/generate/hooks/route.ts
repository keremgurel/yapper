import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { getProjectContextSafe } from "@/lib/content/project-context-server";
import { hookPattern } from "@/lib/content/hook-patterns";
import { GENERATE_CREDITS } from "@/lib/db/constants";
import {
  deductCredits,
  getBalance,
  InsufficientCreditsError,
} from "@/lib/db/credits";
import { ensureUser } from "@/lib/db/users";
import { canUsePremium } from "@/lib/billing/gate";
import { generateHooks, type HooksInput } from "@/lib/generate/hooks";
import { parseSections } from "@/lib/ideas/expand-prompt";
import { sectionsToBlocks } from "@/lib/ideas/expansion-patch";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

// Clamp client-supplied fields so a signed-in user can't amplify token cost.
const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate tagged hook variations for one idea.
 *
 * `patternId` narrows every hook to a single archetype, which is what makes
 * "three more, all stakes-first" a first-class request rather than a reroll.
 * An unknown pattern id is rejected instead of ignored: silently widening it to
 * the full menu would charge for something other than what was asked for.
 *
 * Charge-on-success, like the other generate routes: generate first, deduct
 * after, so a failure never costs a credit.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const cost = GENERATE_CREDITS.hooks;
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    return Response.json({ error: "not_entitled" }, { status: 402 });
  }
  if ((await getBalance(userId)) < cost) {
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const requested = str(body.patternId, 60) ?? null;
  if (requested && !hookPattern(requested)) {
    return Response.json({ error: "bad_pattern" }, { status: 400 });
  }

  const input: HooksInput = {
    title: str(body.title, 300),
    blocks: sectionsToBlocks(parseSections(body.blocks)).slice(0, 8),
    originalNote: str(body.originalNote, 4000),
    patternId: requested,
    context: (await getProjectContextSafe(userId)).block,
  };
  if (!input.title?.trim() && !input.originalNote?.trim()) {
    return Response.json(
      { error: "generate_failed", detail: "no_input" },
      { status: 400 },
    );
  }
  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }

  const spendLimited = await guardProviderSpend(req, userId, "generate-hooks");
  if (spendLimited) return spendLimited;

  let hooks;
  try {
    hooks = await generateHooks(input, req.signal);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "generate_failed";
    const status = detail === "no_input" ? 400 : 502;
    return Response.json({ error: "generate_failed", detail }, { status });
  }

  let balance: number;
  try {
    balance = await deductCredits(userId, cost, {
      metadata: { action: "hooks" },
    });
  } catch (e) {
    // Insufficient = a concurrency race (deliver anyway, per design). Anything
    // else (DB blip) means a free delivery, log it so it's observable.
    if (!(e instanceof InsufficientCreditsError)) {
      console.error("hook generation: deduct failed, delivered free", e);
    }
    balance = await getBalance(userId);
  }

  return Response.json({ hooks, balance });
}
