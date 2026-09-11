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

it("polls TikTok with the original key until inbox delivery", async () => {
  vi.useFakeTimers();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { error: "publish_state_pending", reconcilable: true },
        { status: 503 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ jobId: "tt", draft: true }));
  vi.stubGlobal("fetch", fetchMock);
  try {
    const result = crossPostToTikTok({ mediaKey: "video" }, "same_attempt");
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual({ jobId: "tt", draft: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toEqual(fetchMock.mock.calls[1][1]);
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("preserves TikTok's pending-share cap reason", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "upload_failed",
          reason: "spam_risk_too_many_pending_share",
        },
        { status: 502 },
      ),
    ),
  );
  try {
    await expect(
      crossPostToTikTok({ mediaKey: "video" }, "same_attempt"),
    ).rejects.toThrow("tiktok_spam_risk_too_many_pending_share");
  } finally {
    vi.unstubAllGlobals();
  }
});
