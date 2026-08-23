import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { previewBrainContext } from "@/lib/brain/context/server";
import { budgetFor } from "@/lib/brain/context/budgets";
import { brainSurfaces, type BrainSurface } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";

export const runtime = "nodejs";

const TASK_MAX = 400;

/**
 * What the AI reads, exactly as it reads it.
 *
 * The page renders this verbatim. That is the point: a brain that silently
 * decides what to send is one a creator cannot trust or debug, and "why did it
 * ignore my gap list" is answerable in one glance if the compiled text and its
 * budgets are on screen.
 *
 * No router call, ever. The preview answers "what would this surface read",
 * and spending a provider call each time the creator changes the dropdown would
 * be a bill for looking.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const requested = params.get("surface") ?? "script";
  const surface = (brainSurfaces as readonly string[]).includes(requested)
    ? (requested as BrainSurface)
    : "script";
  const task = (params.get("task") ?? "").slice(0, TASK_MAX);

  await ensureUser(userId);
  const compiled = await previewBrainContext(userId, surface, task);

  return Response.json({
    surface,
    budget: budgetFor(surface),
    core: compiled.core,
    index: compiled.index,
    loaded: compiled.loaded,
    section: compiled.section,
    used: compiled.used,
    // Every routable thing and where it ended up, so a line in the preview can
    // be clicked back to the section it came from.
    entries: compiled.entries.map((entry) => ({
      ref: entry.ref,
      id: entry.id,
      type: entry.type,
      line: entry.line,
      loaded:
        compiled.selection.skillRefs.includes(entry.ref) ||
        compiled.selection.contextRefs.includes(entry.ref),
    })),
  });
}
