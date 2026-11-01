import type { PosterRemoveUploadInput } from "../../../../../protocol/app-actions.generated";
import { removePosterUpload } from "@/lib/publish/operations/remove-upload";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";
import { namedList, plural } from "../ideas/labels";
import { videoTitle } from "./reads";

/** Runs only after the creator confirms, through the same removal as the
 * upload card's Remove button. */
export const removeUploadAction: StudioActionDefinition<PosterRemoveUploadInput> =
  {
    async run({ videoIDs }, { userId }) {
      const removed: string[] = [];
      for (const id of videoIDs) {
        const result = await removePosterUpload(userId, id);
        if (result.ok) {
          removed.push(videoTitle(result.value.title));
          continue;
        }
        if (result.error === "not_found") continue;
        throw new StudioActionFailure(
          result.error,
          result.error === "video_in_use"
            ? "That video is still being published or is scheduled, so I kept it. Try again once it has gone out."
            : "I couldn’t remove that upload.",
        );
      }
      if (!removed.length)
        throw new StudioActionFailure(
          "not_found",
          "Those aren’t Poster uploads, or they were already removed. Only videos uploaded straight to Poster can be removed here.",
        );
      return {
        summary: `Removed ${namedList(removed, "upload")} from Poster.`,
        effects: ["posterVideos"],
      };
    },
    describe({ videoIDs }, names) {
      const known = videoIDs.map((id) => names.videos?.[id]).filter(Boolean);
      return known.length === videoIDs.length
        ? `Remove ${namedList(known as string[], "upload")} from Poster`
        : `Remove ${plural(videoIDs.length, "upload")} from Poster`;
    },
    confirm: { label: "Remove", note: "This can’t be undone." },
  };
