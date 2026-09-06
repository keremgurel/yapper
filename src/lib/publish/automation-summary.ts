import type { getAutomation, AutomationRule } from "@/lib/db/automations";
import type { AutomationResponse, AutomationSummary } from "./automation-types";
import { scheduleSummary } from "./schedule-summary";

export function automationSummary(rule: AutomationRule): AutomationSummary {
  return {
    id: rule.id,
    version: rule.version,
    enabled: rule.enabled,
    settings: rule.settings,
    sourceLabel: rule.sourceLabel,
    accounts: rule.accounts,
    enabledAt: rule.enabledAt?.toISOString() ?? null,
    lastCheckedAt: rule.lastCheckedAt?.toISOString() ?? null,
    error: rule.error,
  };
}
export function automationResponse(
  data: Awaited<ReturnType<typeof getAutomation>>,
  available: boolean,
): AutomationResponse {
  return {
    available,
    rule: data.rule ? automationSummary(data.rule) : null,
    runs: data.runs.map((run) => ({
      id: run.id,
      title: run.title,
      sourceUrl: run.sourceUrl,
      status: run.status,
      error: run.error,
      createdAt: run.createdAt.toISOString(),
      schedules: data.schedules
        .filter((schedule) => schedule.requestKey === run.id)
        .map(scheduleSummary),
    })),
  };
}
