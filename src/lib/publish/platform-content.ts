import type { PublishPlatform } from "@/lib/db/schema";

/** One shared draft, as the AI caption pass produces it: a title and a body. */
export interface PostDraft {
  title: string;
  description: string;
}

/** The per-platform content fields for a post. The caller adds submissionId and
 * contentItemId; this owns only the wording, which differs by platform. */
export type PlatformContent =
  | { platform: "youtube"; title: string; description?: string }
  | { platform: "instagram"; caption?: string }
  | { platform: "tiktok" };

/**
 * Fold a draft's title and body into one caption, for platforms with no
 * separate title field. The title leads, then a blank line, then the body;
 * either half being empty collapses cleanly, and an empty draft yields
 * undefined so no blank caption is sent.
 */
export function combinedCaption(draft: PostDraft): string | undefined {
  const caption = [draft.title.trim(), draft.description.trim()]
    .filter(Boolean)
    .join("\n\n");
  return caption || undefined;
}

/**
 * Map a draft onto a platform's content fields.
 *
 * The draft is now per platform rather than shared: folding one YouTube title
 * and description into an Instagram caption is what made every cross-post read
 * like a cross-post. `combinedCaption` survives for the platforms that have no
 * title field and for callers still holding a single draft.
 *
 * TikTok still takes neither, because it publishes through the inbox endpoint
 * and lands in the creator's drafts to be captioned in the app. Omitting an
 * empty field keeps us from sending "" downstream.
 */
export function platformContent(
  platform: PublishPlatform,
  draft: PostDraft,
): PlatformContent {
  switch (platform) {
    case "youtube":
      return {
        platform,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
      };
    case "instagram":
      return { platform, caption: combinedCaption(draft) };
    case "tiktok":
      return { platform };
  }
}
