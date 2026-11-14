import { describe, expect, it } from "vitest";
import {
  tiktokAudience,
  tiktokDirectPost,
  type TikTokReview,
} from "./tiktok-review";

const review: TikTokReview = {
  mode: "direct",
  caption: "Caption",
  ready: true,
  loading: false,
  settings: {
    privacy: "PUBLIC_TO_EVERYONE",
    allowComment: true,
    allowDuet: true,
    allowStitch: true,
    discloseCommercial: false,
    ownBrand: false,
    brandedContent: false,
    aiGenerated: false,
    accountId: "acct",
  },
};

describe("TikTok review", () => {
  it("names the audience, or the inbox for a draft", () => {
    expect(tiktokAudience(review)).toBe("Everyone");
    expect(tiktokAudience({ ...review, mode: "inbox" })).toBe("Inbox draft");
    expect(tiktokAudience({ ...review, settings: null })).toBe(
      "Choose audience",
    );
    expect(tiktokAudience()).toBe("Choose audience");
  });

  it("adds the sheet's consent and the cover frame to a direct post", () => {
    expect(tiktokDirectPost(review, true, 1500)).toEqual({
      caption: "Caption",
      settings: { ...review.settings, consent: true, coverTimestampMs: 1500 },
    });
    expect(tiktokDirectPost(review, false)?.settings.consent).toBe(false);
  });

  it("sends nothing for an inbox draft", () => {
    expect(tiktokDirectPost({ ...review, mode: "inbox" }, true)).toBeNull();
    expect(tiktokDirectPost(undefined, true)).toBeNull();
  });

  it("refuses a direct post whose settings never loaded", () => {
    expect(() => tiktokDirectPost({ ...review, settings: null }, true)).toThrow(
      "tiktok_settings_required",
    );
  });
});
