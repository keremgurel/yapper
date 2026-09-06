import { auth } from "@clerk/nextjs/server";
import { AutomationConflict, retryAutomationRun } from "@/lib/db/automations";
import { automationsEnabled } from "@/lib/publish/automation-types";
import { UUID_PATTERN } from "@/lib/publish/schedule-input";
export const runtime = "nodejs";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!automationsEnabled())
    return Response.json({ error: "automation_unavailable" }, { status: 503 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id))
    return Response.json({ error: "not_found" }, { status: 404 });
  try {
    await retryAutomationRun(userId, id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AutomationConflict)
      return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
