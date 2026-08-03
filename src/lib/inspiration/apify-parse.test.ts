import { describe, expect, it } from "vitest";
import {
  instagramMedia,
  instagramVideo,
  pick,
  tiktokMedia,
  tiktokVideo,
  youtubeVideo,
} from "@/lib/inspiration/apify-parse";

describe("instagramMedia", () => {
  it("prefers the Reel video and falls back to a separate audio track", () => {
    expect(
      instagramMedia({
        caption: "Twelve hooks",
        displayUrl: "https://cdn/cover.jpg",
        videoUrl: "https://cdn/reel.mp4",
        audioUrl: "https://cdn/audio.mp4",
      }),
    ).toEqual({
      title: "Twelve hooks",
      thumbnail: "https://cdn/cover.jpg",
      mediaUrl: "https://cdn/reel.mp4",
    });
    expect(instagramMedia({ audioUrl: "https://cdn/audio.mp4" }).mediaUrl).toBe(
      "https://cdn/audio.mp4",
    );
  });
});

describe("pick", () => {
  it("reads a nested path and returns undefined when it breaks", () => {
    expect(pick({ a: { b: 1 } }, "a", "b")).toBe(1);
    expect(pick({ a: { b: 1 } }, "a", "c")).toBeUndefined();
    expect(pick({ a: null }, "a", "b")).toBeUndefined();
    expect(pick(undefined, "a")).toBeUndefined();
  });
});

describe("instagramVideo", () => {
  it("maps every field the actor provides", () => {
    const v = instagramVideo(
      {
        url: "https://insta/p/1",
        displayUrl: "https://insta/thumb.jpg",
        caption: "a caption",
        videoViewCount: 5000,
        likesCount: 200,
        commentsCount: 12,
        timestamp: "2026-01-01T00:00:00Z",
      },
      "https://insta/profile",
    );
    expect(v).toEqual({
      url: "https://insta/p/1",
      thumbnail: "https://insta/thumb.jpg",
      title: "a caption",
      views: 5000,
      likes: 200,
      comments: 12,
      postedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("falls back to play count when view count is absent", () => {
    // Reels report videoPlayCount but not videoViewCount; without the fallback
    // the clip would read as 0 views and never surface as an outlier.
    const v = instagramVideo({ videoPlayCount: 9000 }, "https://insta/profile");
    expect(v.views).toBe(9000);
  });

  it("uses the profile url and a placeholder title when the post has neither", () => {
    const v = instagramVideo({}, "https://insta/profile");
    expect(v.url).toBe("https://insta/profile");
    expect(v.title).toBe("Instagram post");
    expect(v.views).toBe(0);
  });
});

describe("tiktokVideo", () => {
  it("reads the nested cover and falls back to the original cover", () => {
    expect(
      tiktokVideo({ videoMeta: { originalCoverUrl: "https://tt/cover.jpg" } })
        .thumbnail,
    ).toBe("https://tt/cover.jpg");
  });

  it("maps counts and defaults an empty url/title", () => {
    const v = tiktokVideo({ playCount: 100, diggCount: 9, commentCount: 3 });
    expect(v).toMatchObject({
      url: "",
      title: "TikTok video",
      views: 100,
      likes: 9,
      comments: 3,
    });
  });
});

describe("tiktokMedia", () => {
  it("maps the direct CDN video used for transcription", () => {
    expect(
      tiktokMedia({
        text: "A hook",
        videoMeta: {
          coverUrl: "https://cdn/cover.jpg",
          downloadAddr: "https://cdn/video.mp4",
        },
      }),
    ).toEqual({
      title: "A hook",
      thumbnail: "https://cdn/cover.jpg",
      mediaUrl: "https://cdn/video.mp4",
    });
  });
});

describe("youtubeVideo", () => {
  it("maps its fields with a placeholder title", () => {
    const v = youtubeVideo({ url: "https://yt/1", viewCount: 4200 });
    expect(v).toMatchObject({
      url: "https://yt/1",
      title: "YouTube video",
      views: 4200,
    });
  });

  it("does not accept a stringified view count", () => {
    // Some actors return counts as numeric strings ("4200"); num() must reject
    // them by type, not silently Number()-coerce, so mixed feeds stay honest.
    expect(youtubeVideo({ viewCount: "4200" }).views).toBe(0);
  });
});
