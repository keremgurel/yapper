import { describe, expect, it } from "vitest";
import {
  allowedTikTokAudiences,
  defaultTikTokChoices,
} from "./tiktok-direct-defaults";
import {
  validateTikTokDirectSettings,
  type TikTokCreator,
} from "./tiktok-direct-settings";

const creator: TikTokCreator = {
  creator_nickname: "Creator",
  creator_username: "creator",
  privacy_level_options: [
    "PUBLIC_TO_EVERYONE",
    "MUTUAL_FOLLOW_FRIENDS",
    "SELF_ONLY",
  ],
  comment_disabled: false,
  duet_disabled: false,
  stitch_disabled: false,
  max_video_post_duration_sec: 600,
};

describe("TikTok posting defaults", () => {
  it("starts a public account on Everyone with interactions on", () => {
    expect(defaultTikTokChoices(creator, true, "acct")).toEqual({
      privacy: "PUBLIC_TO_EVERYONE",
      allowComment: true,
      allowDuet: true,
      allowStitch: true,
      discloseCommercial: false,
      ownBrand: false,
      brandedContent: false,
      aiGenerated: false,
      accountId: "acct",
    });
  });

  it("falls back to Followers on a private account", () => {
    const privateAccount: TikTokCreator = {
      ...creator,
      privacy_level_options: [
        "SELF_ONLY",
        "MUTUAL_FOLLOW_FRIENDS",
        "FOLLOWER_OF_CREATOR",
      ],
    };
    expect(defaultTikTokChoices(privateAccount, true, "acct").privacy).toBe(
      "FOLLOWER_OF_CREATOR",
    );
  });

  it("keeps an unaudited app on Only me", () => {
    expect(allowedTikTokAudiences(creator, false)).toEqual(["SELF_ONLY"]);
    expect(defaultTikTokChoices(creator, false, "acct").privacy).toBe(
      "SELF_ONLY",
    );
  });

  it("leaves off any interaction the account has turned off", () => {
    const choices = defaultTikTokChoices(
      { ...creator, comment_disabled: true, stitch_disabled: true },
      true,
      "acct",
    );
    expect(choices).toMatchObject({
      allowComment: false,
      allowDuet: true,
      allowStitch: false,
    });
  });

  it("leaves the audience blank when the account offers none", () => {
    expect(
      defaultTikTokChoices(
        { ...creator, privacy_level_options: [] },
        true,
        "acct",
      ).privacy,
    ).toBe("");
  });

  it("produces settings the server accepts once consent is given", () => {
    for (const audited of [true, false]) {
      expect(
        validateTikTokDirectSettings(
          { ...defaultTikTokChoices(creator, audited, "acct"), consent: true },
          creator,
          30,
          audited,
        ),
      ).toBeNull();
    }
  });
});
