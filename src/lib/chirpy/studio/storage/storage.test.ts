import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioActionContext, StudioNames } from "../executor";

const mocks = vi.hoisted(() => ({
  listStoredVideos: vi.fn(),
  removeStoredVideo: vi.fn(),
}));
vi.mock("@/lib/db/storage-videos", () => ({
  listStoredVideos: mocks.listStoredVideos,
}));
vi.mock("@/lib/storage/operations/remove-video", () => ({
  removeStoredVideo: mocks.removeStoredVideo,
}));

import { mediaKeyOf, videoID, wantsStorage } from "./reads";
import { deleteRecordingAction } from "./recordings";
import { removeVideosAction } from "./videos";

const MB = 1024 * 1024;
const context = {
  userId: "user_1",
  request: new Request("https://ypr.app/api/chirpy/studio"),
  timeZone: "America/Toronto",
} satisfies StudioActionContext;

function video(id: string, title: string, bytes: number) {
  return { mediaKey: `u/user_1/${id}.mp4`, title, bytes };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listStoredVideos.mockResolvedValue([
    video("a", "Gym myths take 3", 400 * MB),
    video("b", "Q&A live", 200 * MB),
  ]);
  mocks.removeStoredVideo.mockResolvedValue({ ok: true, value: null });
});

describe("studio.storage.removeVideos", () => {
  it("removes each video through the video manager's operation", async () => {
    const outcome = await removeVideosAction.run(
      { videoIDs: ["a.mp4", "b.mp4"] },
      context,
    );
    expect(mocks.removeStoredVideo.mock.calls).toEqual([
      ["user_1", "u/user_1/a.mp4"],
      ["user_1", "u/user_1/b.mp4"],
    ]);
    expect(outcome).toEqual({
      summary:
        "Removed “Gym myths take 3” and “Q&A live” from storage, freeing 600 MB.",
      effects: ["storage", "ideas"],
    });
  });

  it("keeps a video a schedule still needs and says so", async () => {
    mocks.removeStoredVideo
      .mockResolvedValueOnce({ ok: true, value: null })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        error: "video_in_use",
      });
    const outcome = await removeVideosAction.run(
      { videoIDs: ["a.mp4", "b.mp4"] },
      context,
    );
    expect(outcome.partial).toBe(true);
    expect(outcome.summary).toBe(
      "Removed “Gym myths take 3” from storage, freeing 400 MB. “Q&A live” is still needed for a scheduled post, a publish or an unpublished editor export, so I left it.",
    );
  });

  it("fails without removing anything when every video is gone", async () => {
    await expect(
      removeVideosAction.run({ videoIDs: ["missing.mp4"] }, context),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(mocks.removeStoredVideo).not.toHaveBeenCalled();
  });

  it("names the videos and the space in the confirmation", () => {
    const names: StudioNames = {
      ideas: {},
      views: {},
      pillars: {},
      videos: { "a.mp4": "Gym myths take 3", "b.mp4": "Q&A live" },
      sizes: { "a.mp4": String(400 * MB), "b.mp4": String(200 * MB) },
    };
    expect(
      removeVideosAction.describe!({ videoIDs: ["a.mp4", "b.mp4"] }, names),
    ).toBe(
      "Remove “Gym myths take 3” and “Q&A live” from storage, freeing 600 MB",
    );
    expect(
      removeVideosAction.describe!({ videoIDs: ["a.mp4", "c.mp4"] }, names),
    ).toBe("Remove 2 videos from storage");
  });
});

describe("studio.storage.deleteRecording", () => {
  it("says the transcript and feedback go too, and how much space at most", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(
      deleteRecordingAction.describe!(
        { recordingID: id },
        {
          ideas: {},
          views: {},
          pillars: {},
          recordings: { [id]: "Gym myths take 3" },
          sizes: { [id]: String(400 * MB) },
        },
      ),
    ).toBe(
      "Delete the “Gym myths take 3” recording with its transcript and feedback, freeing up to 400 MB",
    );
  });
});

describe("storage reads", () => {
  it.each([
    ["/studio/storage", "free up some space", "list"],
    ["/studio/ideas", "how much storage do I have left", "usage"],
    ["/studio/ideas", "make an idea about gym myths", null],
  ] as const)("%s %s", (surface, request, expected) => {
    expect(wantsStorage(surface, request)).toBe(expected);
  });

  it("shortens a media key for the planner and restores it", () => {
    const id = videoID("user_1", "u/user_1/a.mp4");
    expect(id).toBe("a.mp4");
    expect(mediaKeyOf("user_1", id)).toBe("u/user_1/a.mp4");
    expect(mediaKeyOf("user_1", "u/user_1/a.mp4")).toBe("u/user_1/a.mp4");
  });
});
