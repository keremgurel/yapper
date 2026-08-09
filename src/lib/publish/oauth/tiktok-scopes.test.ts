import { describe, expect, it } from "vitest";
import { tiktokScopes } from "@/lib/publish/oauth/tiktok-scopes";
import { PLATFORMS } from "@/lib/publish/platforms";

describe("tiktokScopes", () => {
  it("asks for the full set by default", () => {
    expect(tiktokScopes({})).toEqual(PLATFORMS.tiktok.scopes);
  });

  it("takes the configured list, comma or space separated", () => {
    expect(
      tiktokScopes({ TIKTOK_SCOPES: "user.info.basic,video.upload" }),
    ).toEqual(["user.info.basic", "video.upload"]);
    expect(
      tiktokScopes({ TIKTOK_SCOPES: "user.info.basic video.list" }),
    ).toEqual(["user.info.basic", "video.list"]);
  });

  it("ignores an empty or whitespace setting rather than asking for nothing", () => {
    // A blank scope list is rejected by TikTok with the same unhelpful "scope"
    // error the setting exists to get out of.
    expect(tiktokScopes({ TIKTOK_SCOPES: "   " })).toEqual(
      PLATFORMS.tiktok.scopes,
    );
    expect(tiktokScopes({ TIKTOK_SCOPES: "" })).toEqual(
      PLATFORMS.tiktok.scopes,
    );
  });
});
