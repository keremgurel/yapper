import { runDuePublishing } from "@/lib/publish/schedule-runner";
import { schedulingEnabled } from "@/lib/publish/schedule-types";
import { isWorkerRequest } from "@/lib/publish/worker-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isWorkerRequest(request))
    return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!schedulingEnabled())
    return Response.json({ enabled: false, claimed: 0, nextDueAt: null });
  return Response.json(await runDuePublishing(request.signal), {
    headers: { "Cache-Control": "no-store" },
  });
}
