import type { PosterCaptionsInput } from "../../../../../protocol/app-actions.generated";
import { loadRecordedTranscript } from "@/lib/content/recorded-transcript";
import type { PublishPlatform } from "@/lib/db/schema";
import { DEFAULT_CAPTION_BRIEF } from "@/lib/publish/caption-prompt";
import { chargedCaptions } from "@/lib/publish/operations/captions";
import {
  failureFrom,
  requireOpen,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import {
  connectedPlatforms,
  platformList,
  postableVideo,
  refusePaused,
} from "./videos";

/**
 * Write a caption per platform through the same billed operation as Poster's
 * Write captions button, then open Poster with them filled in. A video with
 * nothing transcribed is refused before any charge: Poster's own button reads
 * the video first, which a server turn cannot do.
 */
export const writeCaptionsAction: StudioActionDefinition<PosterCaptionsInput> =
  {
    async run(input, context) {
      const { userId, request, signal } = context;
      const { item, title } = await postableVideo(userId, input.videoID);
      requireOpen(
        context,
        `Open “${title}” in Poster and press Generate captions there.`,
      );
      if (input.platforms) refusePaused(input.platforms);
      const connected = await connectedPlatforms(userId);
      const platforms: PublishPlatform[] =
        input.platforms ?? (connected.length ? connected : ["youtube"]);
      const spoken = await loadRecordedTranscript(userId, item);
      if (!spoken?.trim() && !item.script?.trim())
        throw new StudioActionFailure(
          "no_transcript",
          `“${title}” isn’t transcribed yet, so a caption would only know its title. Open it in Poster and press Write captions, which reads the video first.`,
        );
      const written = await chargedCaptions(
        request,
        userId,
        {
          title,
          platforms,
          contentItemId: item.id,
          instructions: input.instructions ?? DEFAULT_CAPTION_BRIEF,
          matchStyle: true,
        },
        signal,
      );
      if (!written.ok) {
        if (written.error === "generate_failed")
          throw new StudioActionFailure(
            "generate_failed",
            "Writing the captions failed, so the credits were refunded.",
          );
        throw failureFrom(written, "captions");
      }
      return {
        summary: `Wrote ${platformList(platforms)} captions for “${title}” and put them in Poster.`,
        effects: [],
        open: {
          tab: "poster",
          params: {
            videoID: item.id,
            title,
            platforms,
            captions: written.value.captions,
          },
        },
      };
    },
  };
