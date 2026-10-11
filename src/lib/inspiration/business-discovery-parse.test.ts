import { describe, expect, it } from "vitest";
import {
  discoveryScrape,
  discoveryVideo,
} from "@/lib/inspiration/business-discovery-parse";

const PROFILE = "https://www.instagram.com/creator/";

describe("discoveryVideo", () => {
  it("maps a Reel to the same row shape the scraper produces", () => {
    expect(
      discoveryVideo(
        {
          caption: "Three hooks that work",
          comments_count: 41,
          like_count: 1200,
          view_count: 52000,
          media_type: "VIDEO",
          media_url: "https://cdn.example/video.mp4",
          thumbnail_url: "https://cdn.example/still.jpg",
          permalink: "https://www.instagram.com/reel/ABC123/",
          timestamp: "2026-10-01T12:30:00+0000",
        },
        PROFILE,
      ),
    ).toEqual({
      url: "https://www.instagram.com/reel/ABC123/",
      thumbnail: "https://cdn.example/still.jpg",
      title: "Three hooks that work",
      views: 52000,
      likes: 1200,
      comments: 41,
      postedAt: "2026-10-01T12:30:00.000Z",
    });
  });

  it("uses the image itself as a photo's thumbnail", () => {
    const row = discoveryVideo(
      { media_type: "IMAGE", media_url: "https://cdn.example/photo.jpg" },
      PROFILE,
    );
    expect(row.thumbnail).toBe("https://cdn.example/photo.jpg");
    expect(row.views).toBe(0);
  });

  it("falls back when Meta omits fields (hidden likes, copyrighted media)", () => {
    expect(discoveryVideo({ media_type: "VIDEO" }, PROFILE)).toEqual({
      url: PROFILE,
      thumbnail: undefined,
      title: "Instagram post",
      views: 0,
      likes: 0,
      comments: 0,
      postedAt: undefined,
    });
  });

  it("drops an unreadable timestamp instead of storing it", () => {
    expect(
      discoveryVideo({ timestamp: "yesterday" }, PROFILE).postedAt,
    ).toBeUndefined();
  });
});

describe("discoveryScrape", () => {
  it("reads the profile identity and every media row", () => {
    const scrape = discoveryScrape(
      {
        name: "A Creator",
        profile_picture_url: "https://cdn.example/avatar.jpg",
        media: { data: [{ permalink: "a" }, { permalink: "b" }] },
      },
      PROFILE,
    );
    expect(scrape.name).toBe("A Creator");
    expect(scrape.avatar).toBe("https://cdn.example/avatar.jpg");
    expect(scrape.videos.map((v) => v.url)).toEqual(["a", "b"]);
  });

  it("returns an empty feed when there is no media edge", () => {
    expect(discoveryScrape({ name: "x" }, PROFILE).videos).toEqual([]);
  });
});
