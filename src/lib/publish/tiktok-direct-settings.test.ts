import { describe, expect, it } from "vitest";
import {
  validateTikTokDirectSettings,
  type TikTokCreator,
  type TikTokDirectSettings,
} from "./tiktok-direct-settings";

const creator: TikTokCreator = {
  creator_nickname: "Creator",
  creator_username: "creator",
  privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"],
  comment_disabled: true,
  duet_disabled: true,
  stitch_disabled: false,
  max_video_post_duration_sec: 60,
};
const settings: TikTokDirectSettings = {
  privacy: "SELF_ONLY",
  allowComment: false,
  allowDuet: false,
  allowStitch: false,
  discloseCommercial: false,
  ownBrand: false,
  brandedContent: false,
  aiGenerated: false,
  consent: true,
  accountId: "creator-1",
};
describe("TikTok export consent", () => {
  it("accepts an explicitly reviewed private test post", () => {
    expect(
      validateTikTokDirectSettings(settings, creator, 30, false),
    ).toBeNull();
  });
  it.each([
    [{ privacy: "" }, "privacy_invalid"],
    [{ privacy: "MUTUAL_FOLLOW_FRIENDS" }, "privacy_invalid"],
    [{ privacy: "PUBLIC_TO_EVERYONE" }, "audit_required"],
    [{ consent: false }, "consent_required"],
    [{ consent: "true" }, "settings_invalid"],
    [{ allowComment: true }, "interaction_disabled"],
    [{ allowDuet: true }, "interaction_disabled"],
    [{ discloseCommercial: true }, "commercial_disclosure_required"],
    [{ ownBrand: true }, "commercial_disclosure_invalid"],
    [
      { discloseCommercial: true, brandedContent: true },
      "branded_content_private",
    ],
    [{ accountId: "" }, "account_required"],
  ])("rejects unreviewed or disallowed settings %j", (patch, reason) => {
    expect(
      validateTikTokDirectSettings(
        { ...settings, ...patch },
        creator,
        30,
        false,
      ),
    ).toBe(reason);
  });
  it.each([0, -1, NaN, Infinity, 61])("rejects duration %s", (duration) => {
    expect(
      validateTikTokDirectSettings(settings, creator, duration, false),
    ).toBe("duration_check_failed");
  });
  it("allows public branded content after audit and explicit consent", () => {
    expect(
      validateTikTokDirectSettings(
        {
          ...settings,
          privacy: "PUBLIC_TO_EVERYONE",
          discloseCommercial: true,
          brandedContent: true,
        },
        creator,
        60,
        true,
      ),
    ).toBeNull();
  });
});
