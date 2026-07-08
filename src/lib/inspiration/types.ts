export type Platform = "youtube" | "tiktok" | "instagram" | "unknown";

/** Inspiration splits into two databases: individual pieces of content
 * ("video") and whole creators/profiles you follow for inspiration
 * ("creator"). Both live in the same store, separated by this discriminator. */
export type InspirationKind = "video" | "creator";

export interface Pillar {
  id: string;
  name: string;
  createdAt: number;
}

/** One scraped post from a creator's feed, normalized across platforms. */
export interface ScrapedVideo {
  url: string;
  thumbnail?: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  /** ISO timestamp of when it was posted, when available. */
  postedAt?: string;
  /** views ÷ the creator's median views — how much this one overperformed. */
  outlierScore?: number;
  /** True when this video meaningfully overperforms the creator's baseline. */
  isOutlier?: boolean;
}

export interface InspirationItem {
  id: string;
  /** Which bucket this belongs to. Legacy items (no kind) are treated as video. */
  kind: InspirationKind;
  /** null = not yet sorted into a pillar */
  pillarId: string | null;
  url: string;
  platform: Platform;
  /** Video: the clip's title. Creator: their display name. */
  title: string;
  /** Video: the channel/author name. Creator: their @handle. */
  author?: string;
  /** Creator only: the normalized handle (no leading @), used to link videos
   * back to the creator who made them. */
  handle?: string;
  /** Video only: the id of the saved creator this clip is attributed to (an
   * explicit link, set on add — more reliable than author-name matching). */
  creatorItemId?: string;
  /** Video: thumbnail. Creator: avatar. */
  thumbnail?: string;
  transcript?: string;
  /** Free-form context the user attached when saving (typed or dictated). */
  note?: string;
  /** Creator only: their scraped feed with engagement stats + outlier flags. */
  videos?: ScrapedVideo[];
  /** Creator only: epoch ms of the last successful scrape (drives refresh). */
  scrapedAt?: number;
  createdAt: number;
}

export interface ResolvedLink {
  kind: InspirationKind;
  platform: Platform;
  title: string;
  author?: string;
  handle?: string;
  thumbnail?: string;
  transcript?: string;
}
