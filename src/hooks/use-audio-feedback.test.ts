import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeFeedback,
  feedbackSourceBlob,
  FeedbackRunFence,
} from "@/hooks/use-audio-feedback";
import {
  registerSourceBlob,
  releaseSourceBlob,
} from "@/lib/studio/source-blob";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("feedback client lifecycle", () => {
  it("cancels and fences a superseded run", () => {
    const fence = new FeedbackRunFence();
    const first = fence.begin();
    const second = fence.begin();

    expect(first.controller.signal.aborted).toBe(true);
    expect(fence.owns(first)).toBe(false);
    expect(fence.owns(second)).toBe(true);

    fence.cancel();
    expect(second.controller.signal.aborted).toBe(true);
    expect(fence.owns(second)).toBe(false);
  });

  it("reuses the original source blob without fetching it", async () => {
    const source = { url: "blob:recording", name: "recording.mp4" };
    const original = new Blob(["video"], { type: "video/mp4" });
    registerSourceBlob(source.url, original);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      const resolved = await feedbackSourceBlob(
        source,
        new AbortController().signal,
      );
      expect(resolved.blob).toBe(original);
      expect(resolved.mimeType).toBe("video/mp4");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      releaseSourceBlob(source.url);
    }
  });

  it("threads one cancellation signal through presign, upload, and feedback", async () => {
    const source = { url: "blob:recording", name: "recording.webm" };
    const original = new Blob(["video"], { type: "video/webm" });
    registerSourceBlob(source.url, original);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: "https://upload.test", key: "k" }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tier: "video" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    try {
      await executeFeedback(source, "video", controller.signal, () => {});
      expect(fetchMock).toHaveBeenCalledTimes(3);
      for (const call of fetchMock.mock.calls) {
        expect(call[1]?.signal).toBe(controller.signal);
      }
      expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(original);
    } finally {
      releaseSourceBlob(source.url);
    }
  });
});
