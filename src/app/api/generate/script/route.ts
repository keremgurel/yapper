import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { GENERATE_CREDITS } from "@/lib/db/constants";
import {
  deductCredits,
  getBalance,
  InsufficientCreditsError,
} from "@/lib/db/credits";
import { ensureUser } from "@/lib/db/users";
import { generateScript, type ScriptInput } from "@/lib/generate/script";

// Clamp client-supplied fields so a signed-in user can't amplify token cost.
const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;
const strArr = (v: unknown, max: number, cap: number): string[] | undefined =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string" && !!x.trim())
        .slice(0, cap)
        .map((x) => x.slice(0, max))
    : undefined;

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate a full spoken-word script from an idea. Auth + credits.
 * Charge-on-success (like idea generation): generate first, then deduct — a
 * failure never costs a credit and there's no stranded state to reconcile.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const cost = GENERATE_CREDITS.script;
  await ensureUser(userId);
  if ((await getBalance(userId)) < cost) {
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input: ScriptInput = {
    title: str(body.title, 300),
    hooks: strArr(body.hooks, 300, 6),
    points: strArr(body.points, 300, 10),
    example: str(body.example, 1000),
    cta: str(body.cta, 300),
  };

  let script: string;
  try {
    script = await generateScript(input);
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
      metadata: { action: "script" },
    });
  } catch (e) {
    if (!(e instanceof InsufficientCreditsError)) {
      console.error("script generation: deduct failed, delivered free", e);
    }
    balance = await getBalance(userId);
  }

  return Response.json({ script, balance });
}
