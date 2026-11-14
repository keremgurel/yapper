import type {
  TikTokCreator,
  TikTokDirectSettings,
  TikTokPrivacy,
} from "./tiktok-direct-settings";

/** Everything the creator chooses in TikTok settings. Consent is given once
 * for the whole post beside the publish button, and the cover frame comes
 * from the cover editor, so neither lives here. */
export type TikTokPostChoices = Omit<
  TikTokDirectSettings,
  "consent" | "coverTimestampMs"
>;

/** Widest audience first: a post from Poster is meant to be seen. */
const AUDIENCE_PREFERENCE: TikTokPrivacy[] = [
  "PUBLIC_TO_EVERYONE",
  "FOLLOWER_OF_CREATOR",
  "MUTUAL_FOLLOW_FRIENDS",
  "SELF_ONLY",
];

/** Audiences this account may post to. Before TikTok's audit only "Only me". */
export function allowedTikTokAudiences(
  creator: TikTokCreator,
  audited: boolean,
): TikTokPrivacy[] {
  return creator.privacy_level_options.filter(
    (privacy) => audited || privacy === "SELF_ONLY",
  );
}

/**
 * What TikTok settings start as: the widest audience the account allows, every
 * interaction the account has not turned off, and no commercial or AI label.
 * The creator can change any of it in posting settings.
 */
export function defaultTikTokChoices(
  creator: TikTokCreator,
  audited: boolean,
  accountId: string,
): TikTokPostChoices {
  const allowed = allowedTikTokAudiences(creator, audited);
  return {
    privacy:
      AUDIENCE_PREFERENCE.find((privacy) => allowed.includes(privacy)) ??
      ("" as TikTokPrivacy),
    allowComment: !creator.comment_disabled,
    allowDuet: !creator.duet_disabled,
    allowStitch: !creator.stitch_disabled,
    discloseCommercial: false,
    ownBrand: false,
    brandedContent: false,
    aiGenerated: false,
    accountId,
  };
}
