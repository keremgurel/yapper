import { describe, expect, it } from "vitest";
import type { PostableVideo } from "@/lib/publish/postable-videos";
import {
  canOpen,
  needsOriginal,
  fromPlatform,
  mediaOf,
  currentPosterVideo,
  fromPostable,
  type PosterVideo,
} from "./poster-video";

const uploaded: PostableVideo = {
  id: "upload-1",
  title: "ep-11",
  submissionId: "submission-1",
  status: "drafting",
  scheduledFor: null,
  updatedAt: "2026-09-05T15:00:00Z",
  transcriptStatus: "pending",
};

describe("open Poster video updates", () => {
  it.each(["ready", "unavailable"] as const)(
    "releases the pending state when transcription becomes %s",
    (transcriptStatus) => {
      const selected = fromPostable(uploaded);
      const active = currentPosterVideo(selected, [
        { ...uploaded, transcriptStatus },
      ]);
      expect(active).toMatchObject({ id: uploaded.id, transcriptStatus });
    },
  );

  it("does not switch videos when another upload finishes", () => {
    const selected = fromPostable({ ...uploaded, id: "upload-2" });
    expect(
      currentPosterVideo(selected, [
        { ...uploaded, transcriptStatus: "ready" },
        { ...uploaded, id: "upload-2" },
      ]),
    ).toMatchObject({ id: "upload-2", transcriptStatus: "pending" });
  });

  it("keeps a newly opened upload while the library catches up", () => {
    const selected = fromPostable(uploaded);
    expect(currentPosterVideo(selected, [])).toBe(selected);
  });

  it("preserves imported platform media and a closed selection", () => {
    const selected: PosterVideo = {
      kind: "platform",
      id: "instagram:post-1",
      title: "Imported Reel",
      platform: "instagram",
      sourceId: "post-1",
      thumbnail: null,
      viewCount: 0,
      publishedAt: "2026-09-05T15:00:00Z",
      url: "https://www.instagram.com/reel/post-1/",
      mediaKey: "imported-master",
      importable: true,
    };
    expect(currentPosterVideo(selected, [uploaded])).toBe(selected);
    expect(currentPosterVideo(null, [uploaded])).toBeNull();
  });
});

describe("channel originals", () => {
  const post = {
    id: "post-1",
    title: "Original title",
    caption: "Original caption\n#tag",
    thumbnail: null,
    viewCount: 4,
    publishedAt: "",
    privacyStatus: "public",
    url: "https://example.com/post-1",
  };
  it.each(["youtube"] as const)(
    "opens %s metadata for attachment without enabling remote import",
    (platform) => {
      const video = fromPlatform(platform, post);
      expect(canOpen(video)).toBe(true);
      expect(needsOriginal(video)).toBe(true);
      expect(video).toMatchObject({
        title: post.title,
        caption: post.caption,
        importable: false,
      });
      expect(mediaOf(video)).toEqual({
        mediaKey: undefined,
        previewUrl: undefined,
      });
    },
  );
  it("imports TikTok posts automatically instead of asking for a local file", () => {
    const video = fromPlatform("tiktok", post);
    expect(canOpen(video)).toBe(true);
    expect(needsOriginal(video)).toBe(false);
    expect(video).toMatchObject({ importable: true, caption: post.caption });
  });
  it("keeps retained sources and Instagram imports working", () => {
    const retained = fromPlatform("youtube", {
      ...post,
      mediaKey: "owned/file.mp4",
    });
    expect(needsOriginal(retained)).toBe(false);
    expect(canOpen(retained)).toBe(true);
    const instagram = fromPlatform("instagram", post);
    expect(needsOriginal(instagram)).toBe(false);
    expect(canOpen(instagram)).toBe(true);
  });
});
