import { describe, expect, it } from "vitest";
import type { PostableVideo } from "@/lib/publish/postable-videos";
import {
  currentPosterVideo,
  fromPostable,
  type PosterVideo,
} from "./poster-video";

const uploaded: PostableVideo = {
  id: "upload-1",
  title: "ep-11",
  submissionId: "submission-1",
  status: "drafted",
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
