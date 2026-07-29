import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { expandIdea } from "@/lib/ideas/expand";
import type { IdeaInput } from "@/lib/ideas/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Expand a raw idea into a full plan (title, pillar, hooks, outline, key points,
 * script). The creator's original words are preserved client-side; this only
 * builds the regenerable plan around them, so it can run again anytime without
 * touching the original.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    input?: IdeaInput;
    pillars?: string[];
  };
  const input = body.input;
  const hasMaterial =
    !!input &&
    (!!input.transcript?.trim() ||
      !!input.url?.trim() ||
      !!input.source?.url?.trim());
  if (!hasMaterial) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }
  const pillars = Array.isArray(body.pillars)
    ? body.pillars
        .filter((p): p is string => typeof p === "string")
        .slice(0, 12)
    : [];

  try {
    const expansion = await expandIdea(input, pillars);
    return Response.json({ expansion });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "expand_failed";
    const status = detail === "no_provider" ? 501 : 502;
    return Response.json({ error: "expand_failed", detail }, { status });
  }
}
