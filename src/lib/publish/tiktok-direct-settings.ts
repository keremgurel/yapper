export const TIKTOK_PRIVACY = [
  "PUBLIC_TO_EVERYONE",
  "MUTUAL_FOLLOW_FRIENDS",
  "FOLLOWER_OF_CREATOR",
  "SELF_ONLY",
] as const;
export type TikTokPrivacy = (typeof TIKTOK_PRIVACY)[number];
export interface TikTokCreator {
  creator_nickname: string;
  creator_username: string;
  creator_avatar_url?: string;
  privacy_level_options: TikTokPrivacy[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}
export interface TikTokDirectSettings {
  privacy: TikTokPrivacy;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  discloseCommercial: boolean;
  ownBrand: boolean;
  brandedContent: boolean;
  aiGenerated: boolean;
  consent: boolean;
  accountId: string;
}
export function validateTikTokDirectSettings(
  value: unknown,
  creator: TikTokCreator,
  duration: number,
  audited: boolean,
): string | null {
  if (!value || typeof value !== "object") return "settings_required";
  const settings = value as TikTokDirectSettings;
  if (
    !TIKTOK_PRIVACY.includes(settings.privacy) ||
    !creator.privacy_level_options.includes(settings.privacy)
  )
    return "privacy_invalid";
  if (!audited && settings.privacy !== "SELF_ONLY") return "audit_required";
  for (const key of [
    "allowComment",
    "allowDuet",
    "allowStitch",
    "discloseCommercial",
    "ownBrand",
    "brandedContent",
    "aiGenerated",
    "consent",
  ] as const)
    if (typeof settings[key] !== "boolean") return "settings_invalid";
  if (!settings.consent) return "consent_required";
  if (
    (creator.comment_disabled && settings.allowComment) ||
    (creator.duet_disabled && settings.allowDuet) ||
    (creator.stitch_disabled && settings.allowStitch)
  )
    return "interaction_disabled";
  if (
    settings.discloseCommercial &&
    !settings.ownBrand &&
    !settings.brandedContent
  )
    return "commercial_disclosure_required";
  if (
    !settings.discloseCommercial &&
    (settings.ownBrand || settings.brandedContent)
  )
    return "commercial_disclosure_invalid";
  if (settings.brandedContent && settings.privacy === "SELF_ONLY")
    return "branded_content_private";
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > creator.max_video_post_duration_sec
  )
    return "duration_check_failed";
  if (typeof settings.accountId !== "string" || !settings.accountId)
    return "account_required";
  return null;
}
