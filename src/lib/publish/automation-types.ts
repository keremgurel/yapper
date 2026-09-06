import { schedulingEnabled, type ScheduleSummary } from "./schedule-types";

export type AutomationDestination = "youtube" | "tiktok";
export interface AutomationSettings {
  destinations: AutomationDestination[];
  stripHashtags: boolean;
  reformatForYouTube: boolean;
}
export interface AutomationAccount {
  platform: AutomationDestination;
  id: string;
  label: string;
}
export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  destinations: ["youtube", "tiktok"],
  stripHashtags: true,
  reformatForYouTube: true,
};
export interface AutomationSummary {
  id: string;
  version: number;
  enabled: boolean;
  settings: AutomationSettings;
  sourceLabel: string | null;
  accounts: AutomationAccount[];
  enabledAt: string | null;
  lastCheckedAt: string | null;
  error: string | null;
}
export interface AutomationRunSummary {
  id: string;
  title: string;
  sourceUrl: string;
  status: "pending" | "importing" | "queued" | "failed" | "cancelled";
  error: string | null;
  createdAt: string;
  schedules: ScheduleSummary[];
}
export interface AutomationResponse {
  available: boolean;
  setupAvailable?: boolean;
  rule: AutomationSummary | null;
  runs: AutomationRunSummary[];
}
export function automationsEnabled() {
  return schedulingEnabled() && process.env.STUDIO_AUTOMATIONS_ENABLED === "1";
}
