import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  deleteContentItems,
  setContentStage,
  updateContentItem,
} from "@/lib/db/content";
import { contentStages, contentStatuses } from "@/lib/db/schema";

export const runtime = "nodejs";

/** One bulk call may not touch an unbounded number of rows. */
const MAX_IDS = 200;

function ids(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .slice(0, MAX_IDS)
    : [];
}

/**
 * Bulk actions for the shared item table: move items between the bank and the
 * library, reclassify them, or delete them. Every query is scoped to the caller,
 * so an id the creator does not own simply matches nothing.
 *
 * Moving is a stage flip and nothing else. That is the whole reason the two
 * surfaces share a table: sending an idea to the library must not transform it.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const targets = ids(body.ids);
  if (!targets.length) {
    return Response.json({ error: "no_ids" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "stage") {
    const stage = body.stage;
    if (!(contentStages as readonly string[]).includes(stage as string)) {
      return Response.json({ error: "bad_stage" }, { status: 400 });
    }
    const moved = await setContentStage(
      userId,
      targets,
      stage as (typeof contentStages)[number],
    );
    return Response.json({ updated: moved });
  }

  if (action === "delete") {
    const removed = await deleteContentItems(userId, targets);
    return Response.json({ updated: removed });
  }

  if (action === "pillar") {
    // A null pillarId clears the classification, which is a legitimate edit.
    const pillarId =
      typeof body.pillarId === "string" && body.pillarId ? body.pillarId : null;
    let updated = 0;
    for (const id of targets) {
      const row = await updateContentItem(userId, id, { pillarId });
      if (row) updated += 1;
    }
    return Response.json({ updated });
  }

  if (action === "status") {
    const status = body.status;
    if (!(contentStatuses as readonly string[]).includes(status as string)) {
      return Response.json({ error: "bad_status" }, { status: 400 });
    }
    // `scheduled` requires a date, which a bulk action has no sensible value
    // for; the DB CHECK would reject it anyway, so refuse it up front.
    if (status === "scheduled") {
      return Response.json({ error: "status_needs_date" }, { status: 400 });
    }
    let updated = 0;
    for (const id of targets) {
      const row = await updateContentItem(userId, id, {
        status: status as (typeof contentStatuses)[number],
      });
      if (row) updated += 1;
    }
    return Response.json({ updated });
  }

  return Response.json({ error: "bad_action" }, { status: 400 });
}
