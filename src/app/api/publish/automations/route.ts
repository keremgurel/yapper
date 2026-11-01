import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import { getAutomation } from "@/lib/db/automations";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import { refusalResponse } from "@/lib/http/operation-result";
import { readAutomationInput } from "@/lib/publish/automation-input";
import { automationResponse } from "@/lib/publish/automation-summary";
import { automationsEnabled } from "@/lib/publish/automation-types";
import { saveAutomationSettings } from "@/lib/publish/operations/save-automation";

export const runtime = "nodejs";
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(
      automationResponse(await getAutomation(userId), automationsEnabled()),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    const error = cause as { code?: string; cause?: { code?: string } };
    if (
      !automationsEnabled() &&
      (error.code === "42P01" || error.cause?.code === "42P01")
    )
      return Response.json({
        available: false,
        rule: null,
        runs: [],
        setupAvailable: false,
      });
    throw cause;
  }
}
async function trackedPUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const saved = await saveAutomationSettings(
      userId,
      await readAutomationInput(request),
    );
    if (!saved.ok) return refusalResponse(saved);
    return Response.json({ rule: saved.value });
  } catch (error) {
    const badInput = requestBodyErrorResponse(error);
    if (badInput) return badInput;
    throw error;
  }
}

export const PUT = withProductAnalytics("automation_saved", trackedPUT);
