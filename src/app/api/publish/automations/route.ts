import { auth } from "@clerk/nextjs/server";
import { canUsePremium } from "@/lib/billing/gate";
import {
  AutomationConflict,
  getAutomation,
  saveAutomationRule,
} from "@/lib/db/automations";
import { getConnectionRow } from "@/lib/db/publish";
import { ensureUser } from "@/lib/db/users";
import { requestBodyErrorResponse } from "@/lib/http/bounded-body";
import { readAutomationInput } from "@/lib/publish/automation-input";
import {
  automationResponse,
  automationSummary,
} from "@/lib/publish/automation-summary";
import {
  automationsEnabled,
  type AutomationAccount,
} from "@/lib/publish/automation-types";

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
export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const input = await readAutomationInput(request);
    if (input.enabled && !automationsEnabled())
      return Response.json(
        { error: "automation_unavailable" },
        { status: 503 },
      );
    let sourceAccountId: string | null = null;
    let sourceLabel: string | null = null;
    const accounts: AutomationAccount[] = [];
    if (input.enabled) {
      if (!(await canUsePremium(userId)))
        return Response.json({ error: "not_entitled" }, { status: 402 });
      for (const platform of [
        "instagram" as const,
        ...input.settings.destinations,
      ]) {
        const row = await getConnectionRow(userId, platform);
        if (!row || row.status !== "active" || !row.externalAccountId)
          return Response.json(
            { error: "destination_not_connected" },
            { status: 409 },
          );
        if (row.externalAccountId !== input.expectedAccounts[platform])
          return Response.json(
            { error: "destination_account_changed" },
            { status: 409 },
          );
        if (platform === "instagram") {
          sourceAccountId = row.externalAccountId;
          sourceLabel = row.handle ?? row.externalAccountId;
        } else
          accounts.push({
            platform,
            id: row.externalAccountId,
            label: row.handle ?? row.externalAccountId,
          });
      }
    }
    await ensureUser(userId);
    const saved = await saveAutomationRule(userId, {
      ...input,
      sourceAccountId,
      sourceLabel,
      accounts,
    });
    return Response.json({ rule: automationSummary(saved) });
  } catch (error) {
    const badInput = requestBodyErrorResponse(error);
    if (badInput) return badInput;
    if (error instanceof AutomationConflict)
      return Response.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
