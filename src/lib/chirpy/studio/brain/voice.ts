import type {
  BrainDeriveInput,
  BrainListenInput,
} from "../../../../../protocol/app-actions.generated";
import {
  deriveVoiceProfile,
  listenToVideo,
} from "@/lib/brain/operations/voice";
import { getActiveProject } from "@/lib/db/projects";
import { listVoiceSamples } from "@/lib/db/voice-samples";
import { tooLong } from "@/lib/voice/units";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";
import { plural } from "../ideas/labels";
import { brainFailure } from "./failure";
import { ESSENTIAL_LABELS, joined, quoted } from "./labels";
import { channelVideos } from "./channel";

const PLATFORM_NAMES = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
} as const;

/**
 * The video picker's "Add to voice" for the channel's newest videos that are
 * not in the voice set yet, one at a time through the same listen operation,
 * each charged on its own length.
 */
export const listenAction: StudioActionDefinition<BrainListenInput> = {
  async run(input, context) {
    const platform = input.platform as keyof typeof PLATFORM_NAMES;
    const name = PLATFORM_NAMES[platform];
    const videos = await channelVideos(context.userId, platform);
    if (!videos)
      throw new StudioActionFailure(
        "not_connected",
        `Connect ${name} first, then ask me again.`,
      );
    const project = await getActiveProject(context.userId);
    const heard = new Set(
      (await listVoiceSamples(project.id))
        .filter((sample) => sample.platform === platform)
        .map((sample) => sample.externalPostId),
    );
    const picked = videos
      .filter((video) => !heard.has(video.id) && !tooLong(video.durationSec))
      .slice(0, input.count ?? 1);
    if (!picked.length)
      throw new StudioActionFailure(
        "nothing_new",
        `Your newest ${name} videos are already in your voice set.`,
      );

    const added: string[] = [];
    let charged = 0;
    let failure: string | null = null;
    for (const video of picked) {
      const result = await listenToVideo(
        context.request,
        context.userId,
        platform,
        video,
        context.signal,
      );
      if (!result.ok) {
        failure = brainFailure(
          result,
          quoted(video.title || "that video"),
        ).sentence;
        break;
      }
      added.push(quoted(video.title || "Untitled video"));
      charged += result.value.charged;
    }
    if (!added.length) throw new StudioActionFailure("listen_failed", failure!);
    return {
      summary: [
        `Added ${joined(added)} to your voice set (${plural(charged, "credit")}).`,
        failure ?? "",
      ]
        .filter(Boolean)
        .join(" "),
      effects: ["brain"],
      partial: failure !== null,
    };
  },
};

/** The voice sheet's "Rewrite from my videos". */
export const deriveAction: StudioActionDefinition<BrainDeriveInput> = {
  async run(_input, context) {
    const derived = await deriveVoiceProfile(
      context.request,
      context.userId,
      context.signal,
    );
    if (!derived.ok) throw brainFailure(derived, "rewriting your voice");
    const { applied, samples } = derived.value;
    const fields = Object.keys(applied).map((key) => ESSENTIAL_LABELS[key]);
    return {
      summary: fields.length
        ? `Rewrote ${joined(fields)} from ${plural(samples, "video")} in your voice set.`
        : "Your videos didn’t give me anything new to write, so your Essentials are unchanged.",
      effects: ["brain"],
    };
  },
};
