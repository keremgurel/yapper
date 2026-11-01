import type { PosterPrepareInput } from "../../../../../protocol/app-actions.generated";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption-format";
import { requireOpen, type StudioActionDefinition } from "../executor";
import { postingInstant } from "../calendar/when";
import { dayLabel } from "../ideas/when";
import type { PosterPrefill } from "./prefill";
import {
  connectedPlatforms,
  platformList,
  postableVideo,
  refusePaused,
} from "./videos";

/** The creator's own words as Poster captions: the caption on every chosen
 * platform, the title on YouTube's. */
function captionsFrom(
  input: PosterPrepareInput,
  platforms: readonly PublishPlatform[],
): PlatformCaption[] {
  const targets =
    input.title && !platforms.includes("youtube")
      ? [...platforms, "youtube" as const]
      : platforms;
  return targets
    .filter((platform) => input.caption || platform === "youtube")
    .map((platform) => ({
      platform,
      title: platform === "youtube" ? (input.title ?? "") : "",
      body: input.caption ?? "",
      hashtags: [],
    }));
}

/**
 * Fill Poster in for one video and open it. Nothing is posted or scheduled:
 * the suggested time only preselects Schedule, and the creator's own button
 * does the rest, the same as opening Poster from a Calendar day.
 */
export const prepareAction: StudioActionDefinition<PosterPrepareInput> = {
  async run(input, context) {
    const { userId, timeZone } = context;
    const { title } = await postableVideo(userId, input.videoID);
    requireOpen(
      context,
      `Open Poster, pick “${title}” and press Publish when it looks right.`,
    );
    const connected = await connectedPlatforms(userId);
    if (input.platforms) refusePaused(input.platforms);
    const platforms = input.platforms ?? connected;
    const at = input.date
      ? postingInstant(input.date, input.time, null, timeZone)
      : null;
    const captions =
      input.caption || input.title ? captionsFrom(input, platforms) : [];
    const params: PosterPrefill = {
      videoID: input.videoID,
      title,
      ...(input.platforms ? { platforms: input.platforms } : {}),
      ...(captions.length ? { captions } : {}),
      ...(input.thumbnailPrompt
        ? { thumbnailPrompt: input.thumbnailPrompt }
        : {}),
      ...(at ? { scheduleAt: at.toISOString() } : {}),
    };
    const missing = platforms.filter(
      (platform) => !connected.includes(platform),
    );
    const where = platforms.length ? ` for ${platformList(platforms)}` : "";
    const when = at
      ? `, with Schedule set to ${dayLabel(at, timeZone, true)}`
      : "";
    return {
      summary:
        `Set up “${title}” in Poster${where}${when}. It posts when you press ${at ? "Schedule" : "Publish"} there.` +
        (input.thumbnailPrompt
          ? " The thumbnail prompt is in its AI box; press Generate to make it."
          : "") +
        (missing.length
          ? ` Connect ${platformList(missing)} in Poster first.`
          : ""),
      effects: [],
      open: { tab: "poster", params },
    };
  },
};
