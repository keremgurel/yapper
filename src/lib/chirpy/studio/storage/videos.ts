import type { StorageRemoveVideosInput } from "../../../../../protocol/app-actions.generated";
import { listStoredVideos } from "@/lib/db/storage-videos";
import { formatStorageBytes } from "@/lib/storage/format";
import { removeStoredVideo } from "@/lib/storage/operations/remove-video";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import { namedList, plural } from "../ideas/labels";
import { mediaKeyOf } from "./reads";

function freed(bytes: number): string {
  return bytes > 0 ? `, freeing ${formatStorageBytes(bytes)}` : "";
}

/** Runs only after the creator confirms, one video at a time through the
 * same removal as the tab's video manager. */
export const removeVideosAction: StudioActionDefinition<StorageRemoveVideosInput> =
  {
    async run({ videoIDs }, { userId }) {
      const stored = new Map(
        (await listStoredVideos(userId)).map((video) => [
          video.mediaKey,
          video,
        ]),
      );
      const removed: string[] = [];
      const inUse: string[] = [];
      let bytes = 0;
      for (const id of videoIDs) {
        const video = stored.get(mediaKeyOf(userId, id));
        if (!video) continue;
        const result = await removeStoredVideo(userId, video.mediaKey);
        if (result.ok) {
          removed.push(video.title);
          bytes += video.bytes;
        } else if (result.error === "video_in_use") inUse.push(video.title);
        else if (result.error !== "not_found")
          throw failureFrom(result, "those videos");
      }
      const held = inUse.length
        ? `${namedList(inUse, "video")} ${inUse.length === 1 ? "is" : "are"} still needed for a scheduled post, a publish or an unpublished editor export, so I left ${inUse.length === 1 ? "it" : "them"}.`
        : "";
      if (!removed.length)
        throw new StudioActionFailure(
          inUse.length ? "video_in_use" : "not_found",
          held || "Those videos were already gone, so nothing was removed.",
        );
      return {
        summary: [
          `Removed ${namedList(removed, "video")} from storage${freed(bytes)}.`,
          held,
        ]
          .filter(Boolean)
          .join(" "),
        // Poster stops offering a removed file, so the idea list reloads too.
        effects: ["storage", "ideas"],
        ...(removed.length < videoIDs.length ? { partial: true } : {}),
      };
    },
    describe({ videoIDs }, names) {
      const titles = videoIDs.map((id) => names.videos?.[id]);
      if (titles.some((title) => !title))
        return `Remove ${plural(videoIDs.length, "video")} from storage`;
      const bytes = videoIDs.reduce(
        (sum, id) => sum + Number(names.sizes?.[id] ?? 0),
        0,
      );
      return `Remove ${namedList(titles as string[], "video")} from storage${freed(bytes)}`;
    },
  };
