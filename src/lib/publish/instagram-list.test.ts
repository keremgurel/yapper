import { describe, expect, it } from "vitest";
import {
  captionToTitle,
  mapInstagramMedia,
  type InstagramMedia,
} from "./instagram-list";

describe("captionToTitle", () => {
  it("takes the first non-empty line, trimmed", () => {
    expect(captionToTitle("  Hello world  \nsecond")).toBe("Hello world");
  });

  it("skips leading blank lines", () => {
    expect(captionToTitle("\n   \nReal title\nmore")).toBe("Real title");
  });

  it("is empty for a missing or blank caption", () => {
    expect(captionToTitle(undefined)).toBe("");
    expect(captionToTitle("   \n  ")).toBe("");
  });
});

describe("mapInstagramMedia", () => {
  const video = (over: Partial<InstagramMedia> = {}): InstagramMedia => ({
    id: "v1",
    media_type: "VIDEO",
    media_url: "https://cdn.example/v1.mp4",
    thumbnail_url: "https://cdn.example/v1.jpg",
    permalink: "https://instagram.com/reel/v1",
    caption: "A reel",
    timestamp: "2026-01-01T00:00:00+0000",
    ...over,
  });

  it("keeps only VIDEO media that has an id", () => {
    const out = mapInstagramMedia([
      video(),
      { ...video({ id: "img" }), media_type: "IMAGE" },
      { ...video({ id: "carousel" }), media_type: "CAROUSEL_ALBUM" },
      video({ id: undefined }),
    ]);
    expect(out.map((v) => v.id)).toEqual(["v1"]);
  });

  it("carries the media_url through as the backfill sourceFileUrl", () => {
    const [v] = mapInstagramMedia([video()]);
    expect(v.sourceFileUrl).toBe("https://cdn.example/v1.mp4");
  });

  // Instagram omits media_url for Reels with licensed audio. Those are usually
  // the newest posts, so dropping them made a just-published Reel invisible.
  it("lists a Reel with no media_url, as a row with no source file", () => {
    const [v] = mapInstagramMedia([
      video({ id: "licensed-audio", media_url: undefined }),
    ]);
    expect(v.id).toBe("licensed-audio");
    expect(v.sourceFileUrl).toBeNull();
    expect(v.thumbnail).toBe("https://cdn.example/v1.jpg");
  });

  it("titles the row from the caption's first line", () => {
    const [v] = mapInstagramMedia([video({ caption: "Line one\nLine two" })]);
    expect(v.title).toBe("Line one");
  });

  it("sorts newest first by timestamp", () => {
    const out = mapInstagramMedia([
      video({ id: "old", timestamp: "2026-01-01T00:00:00+0000" }),
      video({ id: "new", timestamp: "2026-06-01T00:00:00+0000" }),
    ]);
    expect(out.map((v) => v.id)).toEqual(["new", "old"]);
  });
});
