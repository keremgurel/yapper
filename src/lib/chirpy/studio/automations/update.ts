import type { AutomationUpdateInput } from "../../../../../protocol/app-actions.generated";
import { getAutomation } from "@/lib/db/automations";
import { listConnections } from "@/lib/db/publish";
import type { OperationRefusal } from "@/lib/http/operation-result";
import {
  DEFAULT_AUTOMATION_SETTINGS,
  type AutomationDestination,
  type AutomationSettings,
} from "@/lib/publish/automation-types";
import { saveAutomationSettings } from "@/lib/publish/operations/save-automation";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";

const PLATFORM_NAMES: Record<AutomationDestination, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
};

function places(destinations: readonly AutomationDestination[]): string {
  return destinations.map((platform) => PLATFORM_NAMES[platform]).join(" and ");
}

const SENTENCES: Record<string, string> = {
  automation_unavailable:
    "Cross-posting isn’t running on this server yet, so I left the rule off.",
  not_entitled: "Turning cross-posting on needs a paid plan.",
  destination_not_connected:
    "Connect Instagram and every place it copies to in Connections, then ask again.",
  destination_account_changed:
    "A connected account changed while I was saving. Check Connections, then ask again.",
  automation_changed:
    "The rule changed somewhere else while I was saving, so I left it. Ask again.",
};

function failure(refusal: OperationRefusal): StudioActionFailure {
  return new StudioActionFailure(
    refusal.error,
    SENTENCES[refusal.error] ?? "I couldn’t change the cross-posting rule.",
  );
}

function summary(
  enabled: boolean,
  settings: AutomationSettings,
  input: AutomationUpdateInput,
): string {
  if (!enabled) return "Cross-posting is off.";
  const parts = [
    `New Instagram posts now copy to ${places(settings.destinations)}`,
  ];
  if (input.stripHashtags !== undefined)
    parts.push(
      settings.stripHashtags ? "without hashtags" : "with their hashtags",
    );
  if (input.reformatForYouTube !== undefined)
    parts.push(
      settings.reformatForYouTube
        ? "using the first line as the YouTube title"
        : "using the whole caption as the YouTube title",
    );
  return `${parts.join(", ")}.`;
}

/** Runs only after the creator confirms, through the same save as the
 * Automations tab. The accounts checked are the ones connected now. */
export const updateAutomationAction: StudioActionDefinition<AutomationUpdateInput> =
  {
    async run(input, { userId }) {
      if (!Object.keys(input).length)
        throw new StudioActionFailure(
          "bad_request",
          "Tell me what to change about cross-posting.",
        );
      const [{ rule }, connections] = await Promise.all([
        getAutomation(userId),
        listConnections(userId),
      ]);
      const current = rule?.settings ?? DEFAULT_AUTOMATION_SETTINGS;
      const settings: AutomationSettings = {
        destinations:
          (input.destinations as AutomationDestination[] | undefined) ??
          current.destinations,
        stripHashtags: input.stripHashtags ?? current.stripHashtags,
        reformatForYouTube:
          input.reformatForYouTube ?? current.reformatForYouTube,
      };
      const enabled = input.enabled ?? rule?.enabled ?? false;
      const expectedAccounts: Record<string, string> = {};
      for (const row of connections)
        if (row.status === "active" && row.externalAccountId)
          expectedAccounts[row.platform] = row.externalAccountId;
      const saved = await saveAutomationSettings(userId, {
        enabled,
        version: rule?.version ?? 0,
        settings,
        expectedAccounts,
      });
      if (!saved.ok) throw failure(saved);
      return {
        summary: summary(saved.value.enabled, saved.value.settings, input),
        effects: ["automations"],
      };
    },
    describe(input) {
      const destinations = input.destinations as
        | AutomationDestination[]
        | undefined;
      if (input.enabled === false) return "Turn off Instagram cross-posting";
      const where = destinations ? ` to ${places(destinations)}` : "";
      if (input.enabled)
        return `Turn on copying each new Instagram post${where}, until you turn it off`;
      const changes = [
        destinations ? `copy new Instagram posts${where}` : "",
        input.stripHashtags === undefined
          ? ""
          : input.stripHashtags
            ? "drop hashtags from copied captions"
            : "keep hashtags in copied captions",
        input.reformatForYouTube === undefined
          ? ""
          : input.reformatForYouTube
            ? "use the caption’s first line as the YouTube title"
            : "use the whole caption as the YouTube title",
      ].filter(Boolean);
      const sentence = changes.join(" and ") || "change the cross-posting rule";
      return `${sentence[0].toUpperCase()}${sentence.slice(1)}`;
    },
  };
