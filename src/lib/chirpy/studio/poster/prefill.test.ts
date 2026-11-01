import { describe, expect, it } from "vitest";
import { mergeOpen, type StudioOpen } from "./prefill";

const VIDEO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function poster(params: Partial<StudioOpen["params"]>): StudioOpen {
  return {
    tab: "poster",
    params: { videoID: VIDEO, title: "Gym myths", ...params },
  };
}

describe("mergeOpen", () => {
  it("adds a later action's fields to the same video", () => {
    const written = poster({
      platforms: ["tiktok", "youtube"],
      captions: [
        { platform: "tiktok", title: "", body: "Written", hashtags: ["gym"] },
        {
          platform: "youtube",
          title: "AI title",
          body: "Written",
          hashtags: [],
        },
      ],
    });
    const prepared = poster({
      scheduleAt: "2026-11-06T14:00:00.000Z",
      captions: [
        { platform: "youtube", title: "My title", body: "", hashtags: [] },
      ],
    });
    expect(mergeOpen(written, prepared)).toEqual({
      tab: "poster",
      params: {
        videoID: VIDEO,
        title: "Gym myths",
        platforms: ["tiktok", "youtube"],
        scheduleAt: "2026-11-06T14:00:00.000Z",
        captions: [
          { platform: "tiktok", title: "", body: "Written", hashtags: ["gym"] },
          {
            platform: "youtube",
            title: "My title",
            body: "Written",
            hashtags: [],
          },
        ],
      },
    });
  });

  it("lets another video replace the first", () => {
    const other = {
      tab: "poster" as const,
      params: { videoID: OTHER, title: "Other" },
    };
    expect(mergeOpen(poster({ platforms: ["tiktok"] }), other)).toEqual(other);
    expect(mergeOpen(undefined, other)).toEqual(other);
    expect(mergeOpen(other, undefined)).toEqual(other);
  });
});
