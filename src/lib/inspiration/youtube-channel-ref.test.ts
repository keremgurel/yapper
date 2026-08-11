import { describe, expect, it } from "vitest";
import { youtubeChannelRef } from "./youtube-channel-ref";

describe("youtubeChannelRef", () => {
  it("reads a handle URL, tab suffix and all", () => {
    expect(youtubeChannelRef("https://www.youtube.com/@mkbhd")).toEqual({
      by: "handle",
      value: "@mkbhd",
    });
    expect(youtubeChannelRef("https://www.youtube.com/@mkbhd/videos")).toEqual({
      by: "handle",
      value: "@mkbhd",
    });
  });

  it("reads a channel id URL", () => {
    expect(
      youtubeChannelRef(
        "https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ",
      ),
    ).toEqual({ by: "id", value: "UCBJycsmduvYEL83R_U4JriQ" });
  });

  it("reads the legacy /user/ URL", () => {
    expect(
      youtubeChannelRef("https://www.youtube.com/user/marquesbrownlee"),
    ).toEqual({ by: "username", value: "marquesbrownlee" });
  });

  // /c/ vanity paths have no channels.list filter, so they cost a search.
  it("falls back to search for a /c/ vanity URL", () => {
    expect(youtubeChannelRef("https://www.youtube.com/c/MKBHD")).toEqual({
      by: "search",
      value: "MKBHD",
    });
  });

  it("is null for a URL that names no channel", () => {
    expect(youtubeChannelRef("https://www.youtube.com/")).toBeNull();
    expect(youtubeChannelRef("not a url")).toBeNull();
  });
});
