import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformVideo } from "@/lib/publish/client";
import type { PostableVideo } from "@/lib/publish/postable-videos";

/**
 * Anything the Poster can open: a finished Yapper take, or a post already on a
 * connected channel. Both prepare and send the same way; only where the master
 * file comes from differs. A Yapper take resolves through its submission; a
 * channel post carries the R2 key Yapper kept when it published it, or, for
 * Instagram, can have its file imported on demand.
 */
export type PosterVideo =
  | {
      kind: "yapper";
      id: string;
      title: string;
      submissionId: string;
      contentItemId: string;
      status: PostableVideo["status"];
      scheduledFor: string | null;
      transcriptStatus: PostableVideo["transcriptStatus"];
    }
  | {
      kind: "platform";
      id: string;
      title: string;
      platform: PublishPlatform;
      sourceId: string;
      thumbnail: string | null;
      viewCount: number;
      publishedAt: string;
      url: string;
      mediaKey?: string;
      /** The file can be fetched from the platform (Instagram only). */
      importable: boolean;
    };

export function fromPostable(video: PostableVideo): PosterVideo {
  return {
    kind: "yapper",
    id: video.id,
    title: video.title,
    submissionId: video.submissionId,
    contentItemId: video.id,
    status: video.status,
    scheduledFor: video.scheduledFor,
    transcriptStatus: video.transcriptStatus,
  };
}

export function fromPlatform(
  platform: PublishPlatform,
  video: PlatformVideo,
): PosterVideo {
  return {
    kind: "platform",
    id: `${platform}:${video.id}`,
    title: video.title.trim() || "Untitled",
    platform,
    sourceId: video.id,
    thumbnail: video.thumbnail,
    viewCount: video.viewCount,
    publishedAt: video.publishedAt,
    url: video.url,
    mediaKey: video.mediaKey,
    importable:
      platform === "instagram" &&
      (Boolean(video.sourceFileUrl) || Boolean(video.url)),
  };
}

/** Whether Yapper can get at the master file, now or after an import. */
export function canOpen(video: PosterVideo): boolean {
  if (video.kind === "yapper") return true;
  return Boolean(video.mediaKey) || video.importable;
}

/** Where the master lives, for the cover studio and the publish sheet. */
export function mediaOf(video: PosterVideo): {
  submissionId?: string;
  mediaKey?: string;
} {
  return video.kind === "yapper"
    ? { submissionId: video.submissionId }
    : { mediaKey: video.mediaKey };
}
