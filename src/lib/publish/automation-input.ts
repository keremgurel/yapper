import { RequestBodyError, readBoundedJson } from "@/lib/http/bounded-body";
import type {
  AutomationDestination,
  AutomationSettings,
} from "./automation-types";

export async function readAutomationInput(request: Request) {
  const raw = await readBoundedJson(request, { maxBytes: 4096 });
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new RequestBodyError("invalid_body");
  const body = raw as Record<string, unknown>;
  if (
    typeof body.enabled !== "boolean" ||
    !Number.isSafeInteger(body.version) ||
    (body.version as number) < 0
  )
    throw new RequestBodyError("invalid_body");
  const settings = body.settings as Partial<AutomationSettings> | null;
  if (
    !settings ||
    !Array.isArray(settings.destinations) ||
    settings.destinations.length > 2 ||
    new Set(settings.destinations).size !== settings.destinations.length ||
    settings.destinations.some(
      (value) => value !== "youtube" && value !== "tiktok",
    ) ||
    typeof settings.stripHashtags !== "boolean" ||
    typeof settings.reformatForYouTube !== "boolean" ||
    (body.enabled && !settings.destinations.length)
  )
    throw new RequestBodyError("invalid_body");
  const expected = body.expectedAccounts as Record<string, unknown> | undefined;
  const account = (name: string) => {
    const value = expected?.[name];
    if (
      body.enabled &&
      (typeof value !== "string" || !value.trim() || value.length > 200)
    )
      throw new RequestBodyError("invalid_body");
    return typeof value === "string" ? value : "";
  };
  const expectedAccounts: Partial<
    Record<"instagram" | AutomationDestination, string>
  > = { instagram: account("instagram") };
  for (const platform of settings.destinations)
    expectedAccounts[platform] = account(platform);
  return {
    enabled: body.enabled,
    version: body.version as number,
    settings: {
      destinations: settings.destinations,
      stripHashtags: settings.stripHashtags,
      reformatForYouTube: settings.reformatForYouTube,
    },
    expectedAccounts,
  };
}

/** Deterministic formatting preserves the creator's caption. No hidden AI
 * generation or additional credit charge is needed to run this rule. */
export function automationCopy(caption: string, settings: AutomationSettings) {
  const body = (
    settings.stripHashtags
      ? caption.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1")
      : caption
  )
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .trim();
  const firstLine = body.split("\n").find(Boolean) || "New video";
  const title =
    (settings.reformatForYouTube ? firstLine : body.replace(/\s+/g, " ")) ||
    "New video";
  return { title: title.slice(0, 100), description: body.slice(0, 5000) };
}
