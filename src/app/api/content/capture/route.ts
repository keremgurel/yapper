import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { ensureUser } from "@/lib/db/users";
import { createContentItem } from "@/lib/db/content";
import { captureIdea } from "@/lib/content/capture";

export const runtime = "nodejs";
export const maxDuration = 60;

const strArr = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").slice(0, max)
    : [];

/**
 * Talk-or-type capture funnel: enrich a rough idea into a titled, classified
 * content item and persist it. FREE (no credits) — this is the frictionless
 * front door; the credited deep generation stays in the workbench.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ error: "no_input" }, { status: 400 });
  const pillars = strArr(body.pillars, 12);

  await ensureUser(userId);

  let idea;
  try {
    idea = await captureIdea({ text, pillars });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "capture_failed";
    return Response.json({ error: "capture_failed", detail }, { status: 502 });
  }

  // The angle seeds `example`; the classified pillar lands in its own column.
  const item = await createContentItem(userId, {
    title: idea.title,
    hooks: idea.hooks,
    points: idea.points,
    example: idea.angle,
    pillar: idea.pillar ?? undefined,
    status: "drafted",
  });

  return Response.json({ item, pillar: idea.pillar });
}
