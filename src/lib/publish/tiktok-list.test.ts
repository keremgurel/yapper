import { describe, expect, it } from "vitest";
import { mapTikTokVideos } from "@/lib/publish/tiktok-list";

describe("mapTikTokVideos", () => {
  it("maps and sorts the user's recent public videos", () => {
    const videos = mapTikTokVideos([
      {
        id: "old",
        video_description: "Older caption",
        create_time: 100,
        view_count: 12,
      },
      {
        id: "new",
        title: "New title",
        create_time: 200,
        cover_image_url: "https://img/new.jpg",
        share_url: "https://tiktok/new",
        view_count: 34,
      },
      { title: "Missing id" },
    ]);

    expect(videos.map((video) => video.id)).toEqual(["new", "old"]);
    expect(videos[0]).toMatchObject({
      title: "New title",
      thumbnail: "https://img/new.jpg",
      viewCount: 34,
      privacyStatus: "public",
      url: "https://tiktok/new",
    });
    expect(videos[1].title).toBe("Older caption");
  });
});
