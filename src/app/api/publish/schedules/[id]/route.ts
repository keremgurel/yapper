import { auth } from "@clerk/nextjs/server";
import {
  readBoundedJson,
  requestBodyErrorResponse,
  RequestBodyError,
} from "@/lib/http/bounded-body";
import { refusalResponse } from "@/lib/http/operation-result";
import {
  changeSchedule,
  type ScheduleChange,
} from "@/lib/publish/operations/change-schedule";
import { scheduleDate, UUID_PATTERN } from "@/lib/publish/schedule-input";
import { scheduleSummary } from "@/lib/publish/schedule-summary";
import { schedulingEnabled } from "@/lib/publish/schedule-types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return Response.json({ error: "not_found" }, { status: 404 });
  try {
    const body = (await readBoundedJson(request, { maxBytes: 2048 })) as {
      action?: unknown;
      scheduledFor?: unknown;
    } | null;
    if (
      !body ||
      !["cancel", "reschedule", "retry"].includes(String(body.action))
    )
      throw new RequestBodyError("invalid_body");
    const action = body.action as ScheduleChange;
    if (action !== "cancel" && !schedulingEnabled())
      return Response.json(
        { error: "scheduling_unavailable" },
        { status: 503 },
      );
    const date =
      action === "cancel" ? undefined : scheduleDate(body.scheduledFor);
    const result = await changeSchedule(userId, id, action, date);
    if (!result.ok) return refusalResponse(result);
    return Response.json({ schedule: scheduleSummary(result.value) });
  } catch (error) {
    const badInput = requestBodyErrorResponse(error);
    if (badInput) return badInput;
    throw error;
  }
}
