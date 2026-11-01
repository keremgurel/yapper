import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption-format";

/**
 * What Poster opens with when Chirpy prepares a post: the video, and whatever
 * the creator asked for filled in. Nothing here posts; the creator's own
 * Publish or Schedule button does.
 */
export interface PosterPrefill {
  /** The library item behind the video, as Poster's `?item=` link takes it. */
  videoID: string;
  /** Its title, for a client that has to say where to find it. */
  title: string;
  platforms?: PublishPlatform[];
  captions?: PlatformCaption[];
  /** Goes in the thumbnail's AI box; the creator presses Generate. */
  thumbnailPrompt?: string;
  /** An ISO instant for the Schedule option, as a Calendar day link gives. */
  scheduleAt?: string;
}

/** A tab a reply opens, with its state filled in. */
export type StudioOpen = { tab: "poster"; params: PosterPrefill };

/** One platform's caption with the later one's filled-in fields on top, so a
 * title set after written captions keeps their body. */
function mergeCaption(
  earlier: PlatformCaption | undefined,
  later: PlatformCaption,
): PlatformCaption {
  if (!earlier) return later;
  return {
    platform: later.platform,
    title: later.title || earlier.title,
    body: later.body || earlier.body,
    hashtags: later.body ? later.hashtags : earlier.hashtags,
  };
}

/** Two actions in one turn that open the same video add up: the later one's
 * fields win, and captions merge by platform. Another video replaces it. */
export function mergeOpen(
  current: StudioOpen | undefined,
  next: StudioOpen | undefined,
): StudioOpen | undefined {
  if (!next) return current;
  if (!current || current.params.videoID !== next.params.videoID) return next;
  const captions = new Map(
    (current.params.captions ?? []).map((caption) => [
      caption.platform,
      caption,
    ]),
  );
  for (const caption of next.params.captions ?? [])
    captions.set(
      caption.platform,
      mergeCaption(captions.get(caption.platform), caption),
    );
  return {
    tab: "poster",
    params: {
      ...current.params,
      ...next.params,
      ...(captions.size ? { captions: [...captions.values()] } : {}),
    },
  };
}
