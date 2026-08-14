import { afterEach, describe, expect, it, vi } from "vitest";

import {
  crossPostToInstagram,
  crossPostToTikTok,
  crossPostToYouTube,
} from "./client";

describe("publish client idempotency", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the caller-owned attempt key to every irreversible route", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ jobId: "yt", url: "yt" }))
      .mockResolvedValueOnce(Response.json({ jobId: "ig", url: "ig" }))
      .mockResolvedValueOnce(Response.json({ jobId: "tt", draft: true }));
    vi.stubGlobal("fetch", fetchMock);

    await crossPostToYouTube(
      { mediaKey: "video", title: "Title" },
      "youtube_attempt",
    );
    await crossPostToInstagram({ mediaKey: "video" }, "instagram_attempt");
    await crossPostToTikTok({ mediaKey: "video" }, "tiktok_attempt");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => call[1]?.headers)).toEqual([
      {
        "Content-Type": "application/json",
        "Idempotency-Key": "youtube_attempt",
      },
      {
        "Content-Type": "application/json",
        "Idempotency-Key": "instagram_attempt",
      },
      {
        "Content-Type": "application/json",
        "Idempotency-Key": "tiktok_attempt",
      },
    ]);
  });

  it("distinguishes an active replay from a disconnected account", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "publish_in_progress" }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "youtube_not_connected" }, { status: 409 }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "publish_attempt_failed" }, { status: 409 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      crossPostToYouTube({ mediaKey: "video", title: "Title" }, "attempt_1"),
    ).rejects.toThrow("publish_in_progress");
    await expect(
      crossPostToYouTube({ mediaKey: "video", title: "Title" }, "attempt_2"),
    ).rejects.toThrow("not_connected");
    await expect(
      crossPostToYouTube({ mediaKey: "video", title: "Title" }, "attempt_3"),
    ).rejects.toThrow("publish_attempt_failed");
  });

  it("treats an unresolved provider outcome as still in progress", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            Response.json({ error: "publish_state_pending" }, { status: 503 }),
          ),
        ),
    );

    await expect(
      crossPostToYouTube(
        { mediaKey: "video", title: "Title" },
        "attempt_pending",
      ),
    ).rejects.toThrow("publish_in_progress");
    await expect(
      crossPostToInstagram({ mediaKey: "video" }, "instagram_pending"),
    ).rejects.toThrow("publish_in_progress");
  });
});
