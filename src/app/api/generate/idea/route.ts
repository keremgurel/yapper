import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { GENERATE_CREDITS } from "@/lib/db/constants";
import { deductCredits, getBalance } from "@/lib/db/credits";
import { ensureUser } from "@/lib/db/users";
import { generateIdea, type IdeaInput } from "@/lib/generate/idea";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate a video idea (hooks/points/example/cta). Auth + credits.
 * Charge-on-success: we generate first, then deduct — so a failure never costs
 * a credit and there's no stranded "processing" state to reconcile.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const cost = GENERATE_CREDITS.idea;
  await ensureUser(userId);
  if ((await getBalance(userId)) < cost) {
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  }

  const input = (await req.json().catch(() => ({}))) as IdeaInput;

  let idea;
  try {
    idea = await generateIdea(input);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "generate_failed";
    const status = detail === "no_input" ? 400 : 502;
    return Response.json({ error: "generate_failed", detail }, { status });
  }

  // Charge only now that we have a result. If the deduct races and fails, we
  // still deliver (favor the user — a rare, cheap edge case).
  let balance: number;
  try {
    balance = await deductCredits(userId, cost, {
      metadata: { action: "idea" },
    });
  } catch {
    balance = await getBalance(userId);
  }

  return Response.json({ ...idea, balance });
}
