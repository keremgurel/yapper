import { afterEach, describe, expect, it, vi } from "vitest";
import { postInstagramReel } from "./instagram";
import { createPublishWorkflow } from "./workflow";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("postInstagramReel", () => {
  it("bounds the create, poll, publish, and permalink control chain", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(
        Response.json({ status_code: "FINISHED", status: "ready" }),
      )
      .mockResolvedValueOnce(Response.json({ id: "media-1" }))
      .mockResolvedValueOnce(
        Response.json({ permalink: "https://instagram.example/reel/1" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = postInstagramReel(
      {
        accessToken: "token",
        igUserId: "user-1",
        videoUrl: "https://media.example/video.mp4",
      },
      createPublishWorkflow(new AbortController().signal),
    );
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({
      mediaId: "media-1",
      url: "https://instagram.example/reel/1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit | undefined)?.signal).toBeInstanceOf(
        AbortSignal,
      );
    }
  });

  it("aborts a pending poll without starting publish", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "container-1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = postInstagramReel(
      {
        accessToken: "token",
        igUserId: "user-1",
        videoUrl: "https://media.example/video.mp4",
      },
      createPublishWorkflow(controller.signal),
    );
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();

    await expect(result).rejects.toMatchObject({ code: "aborted" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a stable fallback URL when permalink lookup fails after publish", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media-1" }))
      .mockRejectedValueOnce(new TypeError("network"));
    vi.stubGlobal("fetch", fetchMock);

    const result = postInstagramReel(
      {
        accessToken: "token",
        igUserId: "user-1",
        videoUrl: "https://media.example/video.mp4",
      },
      createPublishWorkflow(new AbortController().signal),
    );
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({
      mediaId: "media-1",
      url: "",
    });
  });

  it("preserves an unknown outcome when media_publish loses its response", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockRejectedValueOnce(new TypeError("connection reset"));
    vi.stubGlobal("fetch", fetchMock);

    const result = postInstagramReel(
      {
        accessToken: "token",
        igUserId: "user-1",
        videoUrl: "https://media.example/video.mp4",
      },
      createPublishWorkflow(new AbortController().signal),
    );
    const rejection = expect(result).rejects.toMatchObject({
      name: "PublishOutcomeUnknownError",
    });
    await vi.runAllTimersAsync();

    await rejection;
  });
});
