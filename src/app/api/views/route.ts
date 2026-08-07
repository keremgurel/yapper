import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  createView,
  listViews,
  seedViewsIfEmpty,
} from "@/lib/db/library-views";
import { ensureUser } from "@/lib/db/users";
import { contentStages, type ContentStage } from "@/lib/db/schema";
import { parseViewInput } from "@/lib/views/input";

export const runtime = "nodejs";

/** A creator may not accumulate views without limit; the tab strip stops being
 * navigable long before this, and it caps the seeding loop too. */
const MAX_VIEWS = 20;

function stageOf(req: NextRequest): ContentStage {
  const raw = new URL(req.url).searchParams.get("stage");
  return (contentStages as readonly string[]).includes(raw ?? "")
    ? (raw as ContentStage)
    : "library";
}

/** The creator's saved views for one surface, seeded on first read. */
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await ensureUser(userId);
  const views = await seedViewsIfEmpty(userId, stageOf(req));
  return Response.json({ views });
}

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input = parseViewInput(body);
  if (!input) return Response.json({ error: "bad_view" }, { status: 400 });

  await ensureUser(userId);
  const stage = stageOf(req);
  const existing = await listViews(userId, stage);
  if (existing.length >= MAX_VIEWS) {
    return Response.json({ error: "too_many_views" }, { status: 400 });
  }

  const view = await createView(userId, stage, input, existing.length);
  return Response.json({ view });
}
