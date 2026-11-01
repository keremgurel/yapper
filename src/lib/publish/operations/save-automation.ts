import { canUsePremium } from "@/lib/billing/gate";
import { AutomationConflict, saveAutomationRule } from "@/lib/db/automations";
import { getConnectionRow } from "@/lib/db/publish";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import type { readAutomationInput } from "@/lib/publish/automation-input";
import { automationSummary } from "@/lib/publish/automation-summary";
import {
  automationsEnabled,
  type AutomationAccount,
  type AutomationSummary,
} from "@/lib/publish/automation-types";

export type AutomationInput = Awaited<ReturnType<typeof readAutomationInput>>;

/** Save the cross-posting rule. Turning it on needs a plan, and Instagram
 * plus every destination connected to the accounts the creator saw. */
export async function saveAutomationSettings(
  userId: string,
  input: AutomationInput,
): Promise<OperationResult<AutomationSummary>> {
  if (input.enabled && !automationsEnabled())
    return refused(503, "automation_unavailable");
  let sourceAccountId: string | null = null;
  let sourceLabel: string | null = null;
  const accounts: AutomationAccount[] = [];
  if (input.enabled) {
    if (!(await canUsePremium(userId))) return refused(402, "not_entitled");
    for (const platform of [
      "instagram" as const,
      ...input.settings.destinations,
    ]) {
      const row = await getConnectionRow(userId, platform);
      if (!row || row.status !== "active" || !row.externalAccountId)
        return refused(409, "destination_not_connected");
      if (row.externalAccountId !== input.expectedAccounts[platform])
        return refused(409, "destination_account_changed");
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
  try {
    const saved = await saveAutomationRule(userId, {
      ...input,
      sourceAccountId,
      sourceLabel,
      accounts,
    });
    return succeeded(automationSummary(saved));
  } catch (error) {
    if (error instanceof AutomationConflict) return refused(409, error.message);
    throw error;
  }
}
