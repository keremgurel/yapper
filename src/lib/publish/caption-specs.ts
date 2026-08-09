import type { PublishPlatform } from "@/lib/db/schema";

/**
 * What each platform actually wants from a caption.
 *
 * Held as data rather than baked into one prompt because the three are genuinely
 * different artifacts, and the old code treated them as one: it wrote a YouTube
 * title and description, then Instagram pasted both together and TikTok got
 * nothing. A Shorts title is a search-and-click object; an Instagram caption is
 * a hook line followed by an unfurled body; a TikTok caption is one punchy line
 * with tags. Rendering the same words three ways is how a cross-post ends up
 * reading like it was cross-posted.
 */
export interface CaptionSpec {
  platform: PublishPlatform;
  label: string;
  /** Whether the platform has a title field distinct from the body. */
  hasTitle: boolean;
  titleMax: number;
  bodyMax: number;
  /**
   * How much of the body a viewer sees before "more". The first line has to
   * carry the post on its own within this budget.
   */
  visibleChars: number;
  hashtags: { min: number; max: number };
  /** Written into the prompt, so the model shapes rather than reformats. */
  guidance: string;
  /**
   * True when the platform accepts the caption over the API. TikTok publishes
   * through the inbox endpoint, which lands in the creator's drafts and takes
   * no caption at all, so its text exists to be copied in the TikTok app.
   */
  postable: boolean;
}

export const CAPTION_SPECS: Record<PublishPlatform, CaptionSpec> = {
  youtube: {
    platform: "youtube",
    label: "YouTube Shorts",
    hasTitle: true,
    titleMax: 100,
    bodyMax: 5000,
    visibleChars: 100,
    hashtags: { min: 2, max: 4 },
    guidance:
      "The title is the whole click decision and is also searched, so lead " +
      "with the concrete subject in plain words rather than a tease. The " +
      "description adds context for someone already watching and can carry a " +
      "link or a next step.",
    postable: true,
  },
  instagram: {
    platform: "instagram",
    label: "Instagram Reels",
    hasTitle: false,
    titleMax: 0,
    bodyMax: 2200,
    visibleChars: 125,
    hashtags: { min: 3, max: 8 },
    guidance:
      "There is no title. The first line is the entire hook and must work " +
      "alone, because everything after it is collapsed behind 'more'. Then a " +
      "short body that earns the tap, then a question or invitation that gives " +
      "people a reason to comment.",
    postable: true,
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    hasTitle: false,
    titleMax: 0,
    bodyMax: 2200,
    visibleChars: 90,
    hashtags: { min: 2, max: 5 },
    guidance:
      "One or two lines, spoken not written, the way a person captions their " +
      "own video. No throat-clearing and no marketing cadence. Tags are part " +
      "of the sentence's world, not a block of SEO.",
    postable: false,
  },
};

export function captionSpec(platform: PublishPlatform): CaptionSpec {
  return CAPTION_SPECS[platform];
}
