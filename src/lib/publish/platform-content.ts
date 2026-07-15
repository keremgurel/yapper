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
 * Map one shared draft onto a platform's content fields. YouTube is the only
 * platform with a real title + description; Instagram folds both into a single
 * caption; TikTok takes neither, since it lands in the user's drafts to caption
 * in the app. Omitting an empty field keeps us from sending "" downstream.
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
