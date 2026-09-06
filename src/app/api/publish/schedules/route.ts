import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import {
  createPublishingSchedules,
  findScheduleRequest,
  listPublishingSchedules,
  ScheduleConflict,
  type NewPublishingSchedule,
} from "@/lib/db/publishing-schedules";
import { getContentItem } from "@/lib/db/content";
import { getConnectionRow } from "@/lib/db/publish";
import { protectPendingThumbnail } from "@/lib/db/r2-lifecycle";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import { resolveOwnedMediaKey } from "@/lib/publish/media";
import { readScheduleInput, scheduleDate } from "@/lib/publish/schedule-input";
import { schedulingEnabled } from "@/lib/publish/schedule-types";
import { scheduleSummary } from "@/lib/publish/schedule-summary";
import { ownsKey } from "@/lib/r2";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const enabled = schedulingEnabled();
  let rows: Awaited<ReturnType<typeof listPublishingSchedules>>;
  try {
    rows = await listPublishingSchedules(userId);
  } catch (cause) {
    // The flag is off before this migration rolls out. Once installed, paused
    // queues must remain visible and cancellable. Other DB failures stay errors.
    const error = cause as { code?: string; cause?: { code?: string } };
    if (!enabled && (error.code === "42P01" || error.cause?.code === "42P01"))
      rows = [];
    else throw cause;
  }
  return Response.json(
    { enabled, schedules: rows.map(scheduleSummary) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!schedulingEnabled())
    return Response.json({ error: "scheduling_unavailable" }, { status: 503 });
  try {
    const plan = await readScheduleInput(request, false);
    const hash = createHash("sha256")
      .update(JSON.stringify(plan))
      .digest("hex");
    const replay = await findScheduleRequest(userId, plan.requestKey, hash);
    if (replay.length)
      return Response.json({ schedules: replay.map(scheduleSummary) });
    scheduleDate(plan.scheduledFor.toISOString());
    const entries: NewPublishingSchedule[] = [];
    for (const target of plan.targets) {
      const media = await resolveOwnedMediaKey(userId, target.input);
      if (!media.ok)
        return Response.json({ error: media.error }, { status: media.status });
      const connection = await getConnectionRow(userId, target.platform);
      if (
        !connection ||
        connection.status !== "active" ||
        !connection.externalAccountId
      ) {
        return Response.json(
          { error: "destination_not_connected" },
          { status: 409 },
        );
      }
      if (connection.externalAccountId !== target.expectedAccountId)
        return Response.json(
          { error: "destination_account_changed" },
          { status: 409 },
        );
      const item = target.input.contentItemId
        ? await getContentItem(userId, target.input.contentItemId)
        : null;
      if (target.input.contentItemId && !item)
        return Response.json(
          { error: "content_item_unavailable" },
          { status: 404 },
        );
      const input = { ...target.input };
      delete input.submissionId;
      if (
        input.thumbnailKey &&
        (!ownsKey(userId, input.thumbnailKey) ||
          !(await protectPendingThumbnail(
            userId,
            input.thumbnailKey,
            new Date(plan.scheduledFor.getTime() + 24 * 60 * 60_000),
          )))
      )
        return Response.json(
          { error: "thumbnail_unavailable" },
          { status: 409 },
        );
      entries.push({
        platform: target.platform,
        externalAccountId: connection.externalAccountId,
        accountLabel: connection.handle ?? connection.externalAccountId,
        title:
          ("title" in input ? input.title : undefined) ||
          item?.title ||
          "Scheduled video",
        input: { ...input, mediaKey: media.mediaKey },
        contentItemId: input.contentItemId ?? null,
        scheduledFor: plan.scheduledFor,
        timezone: plan.timezone,
      });
    }
    // Submission aliases can resolve to the same stored video. Reject duplicate
    // operations after resolution as well as duplicate inputs during parsing.
    const resolved = entries.map(
      (entry) => `${entry.platform}:${entry.input.mediaKey}`,
    );
    if (new Set(resolved).size !== resolved.length)
      return Response.json({ error: "duplicate_destination" }, { status: 400 });
    const rows = await createPublishingSchedules(
      userId,
      plan.requestKey,
      hash,
      entries,
    );
    return Response.json(
      { schedules: rows.map(scheduleSummary) },
      { status: 201 },
    );
  } catch (error) {
    const badInput = requestBodyErrorResponse(error);
    if (badInput) return badInput;
    if (error instanceof ScheduleConflict)
      return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
