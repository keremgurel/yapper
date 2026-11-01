import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { listViews, seedViewsIfEmpty } from "@/lib/db/library-views";
import { ensureUser } from "@/lib/db/users";
import { contentStages, type ContentStage } from "@/lib/db/schema";
import { refusalResponse } from "@/lib/http/operation-result";
import { withServerTiming } from "@/lib/http/server-timing";
import { createOwnView } from "@/lib/views/operations/create-view";

export const runtime = "nodejs";

function stageOf(req: NextRequest): ContentStage {
  const raw = new URL(req.url).searchParams.get("stage");
  return (contentStages as readonly string[]).includes(raw ?? "")
    ? (raw as ContentStage)
    : "library";
}

/** The creator's saved views for one surface, seeded on first read. A creator
 * who already has views gets one plain select; only an empty surface pays for
 * the user check and the locked seeding transaction. */
export const GET = withServerTiming(
  async (req: NextRequest): Promise<Response> => {
    const { userId } = await auth();
    if (!userId)
      return Response.json({ error: "unauthorized" }, { status: 401 });

    const stage = stageOf(req);
    let views = await listViews(userId, stage);
    if (!views.length) {
      await ensureUser(userId);
      views = await seedViewsIfEmpty(userId, stage);
    }
    return Response.json({ views });
  },
);

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const created = await createOwnView(userId, stageOf(req), body);
  if (!created.ok) return refusalResponse(created);
  return Response.json({ view: created.value });
}
