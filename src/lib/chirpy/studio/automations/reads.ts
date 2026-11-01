import { getAutomation } from "@/lib/db/automations";
import { listConnections } from "@/lib/db/publish";
import {
  automationsEnabled,
  type AutomationSettings,
} from "@/lib/publish/automation-types";

type Platform = "instagram" | "youtube" | "tiktok";

/** The cross-posting rule as the planner sees it. */
export interface AutomationsOverview {
  /** False when this server does not run automations. */
  available: boolean;
  rule: ({ enabled: boolean } & AutomationSettings) | null;
  /** Handles of the accounts connected now, by platform. */
  connected: Partial<Record<Platform, string>>;
  /** The three newest copies, so a question about one can be answered. */
  recentRuns: { title: string; status: string; error?: string }[];
}

const MENTIONS_AUTOMATIONS =
  /\b(?:automations?|automatic(?:ally)?|auto-?post\w*|cross-?post\w*)\b/i;

/** Read on the Automations tab and for requests that talk about the rule. */
export function wantsAutomations(surface: string, request: string): boolean {
  return (
    surface.startsWith("/studio/automations") ||
    MENTIONS_AUTOMATIONS.test(request)
  );
}

export async function readAutomationsOverview(
  userId: string,
): Promise<AutomationsOverview> {
  const available = automationsEnabled();
  const [data, connections] = await Promise.all([
    // Without automations the table may not exist; the tab says the same.
    getAutomation(userId).catch((cause) => {
      if (available) throw cause;
      return { rule: null, runs: [] };
    }),
    listConnections(userId),
  ]);
  const connected: AutomationsOverview["connected"] = {};
  for (const row of connections)
    if (
      row.status === "active" &&
      ["instagram", "youtube", "tiktok"].includes(row.platform)
    )
      connected[row.platform as Platform] =
        row.handle ?? row.externalAccountId ?? "connected";
  return {
    available,
    rule: data.rule
      ? { enabled: data.rule.enabled, ...data.rule.settings }
      : null,
    connected,
    recentRuns: data.runs.slice(0, 3).map((run) => ({
      title: run.title.slice(0, 80),
      status: run.status,
      ...(run.error ? { error: run.error } : {}),
    })),
  };
}
