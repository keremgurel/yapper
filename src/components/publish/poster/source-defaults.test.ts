import { describe, expect, it } from "vitest";
import { fromPlatform } from "./poster-video";
import { sourceCaptions, sourceCover } from "./source-defaults";
import { withCoverFrame } from "./cover-draft";
import { mergeGeneratedCaptions } from "../captions/caption-draft";

const video = fromPlatform("instagram", {
  id: "123",
  title: "ep 11.",
  caption: "ep 11.\n\nWhat actually happened. #building",
  thumbnail: "https://cdninstagram.com/cover.jpg",
  viewCount: 0,
  publishedAt: "",
  privacyStatus: "public",
  url: "https://instagram.com/reel/123",
});

describe("Instagram cross-post defaults", () => {
  it("keeps the full caption, including line breaks and hashtags, for every destination", () => {
    for (const caption of Object.values(sourceCaptions(video))) {
      expect(caption.body).toBe("ep 11.\n\nWhat actually happened. #building");
      expect(caption.hashtags).toEqual([]);
      expect(caption.title).toBe("");
    }
  });
  it("keeps the original cover when the initial video frame arrives", () => {
    const cover = sourceCover(video);
    expect(cover.image).toBe("/api/publish/instagram/thumbnail?mediaId=123");
    expect(
      withCoverFrame(cover, { image: "first-frame", time: 1 }),
    ).toMatchObject({
      source: "original",
      image: cover.image,
      frameImage: "first-frame",
    });
  });
  it("uses a video frame when no original thumbnail exists", () => {
    expect(
      sourceCover({ ...video, thumbnail: null } as typeof video),
    ).toMatchObject({ source: "frame", image: null });
  });
  it("generates a title without overwriting the latest caption edits", () => {
    const current = {
      ...sourceCaptions(video),
      youtube: {
        platform: "youtube" as const,
        title: "",
        body: "My edit",
        hashtags: ["custom"],
      },
    };
    const result = mergeGeneratedCaptions(
      current,
      [
        {
          platform: "youtube",
          title: "A grounded title",
          body: "AI rewrite",
          hashtags: ["ai"],
        },
      ],
      true,
    );
    expect(result.youtube).toEqual({
      platform: "youtube",
      title: "A grounded title",
      body: "My edit",
      hashtags: ["custom"],
    });
    expect(result.tiktok).toEqual(current.tiktok);
  });
  it("uses the original caption when generating a title before any edits", () => {
    expect(
      mergeGeneratedCaptions(
        undefined,
        [{ platform: "youtube", title: "Title", body: "", hashtags: [] }],
        true,
        "Original",
      ).youtube?.body,
    ).toBe("Original");
  });
});
