import { describe, expect, it, vi } from "vitest";
import {
  downloadInstagramClip,
  InstagramClipTooLargeError,
  InstagramDownloadError,
  InstagramDownloadTimeoutError,
} from "./instagram-import";

function responseWithChunks(chunks: number[], headers?: HeadersInit): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const size of chunks) controller.enqueue(new Uint8Array(size));
        controller.close();
      },
    }),
    { status: 200, headers },
  );
}

describe("downloadInstagramClip", () => {
  it("streams a clip up to the exact byte limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(responseWithChunks([2, 3]));

    const clip = await downloadInstagramClip(
      "https://scontent.cdninstagram.com/clip.mp4",
      { maxBytes: 5, fetchImpl },
    );

    expect(clip.byteLength).toBe(5);
    await clip.cleanup();
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://scontent.cdninstagram.com/clip.mp4"),
      expect.objectContaining({ redirect: "manual", cache: "no-store" }),
    );
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(responseWithChunks([1], { "content-length": "6" }));

    await expect(
      downloadInstagramClip("https://scontent.cdninstagram.com/clip.mp4", {
        maxBytes: 5,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(InstagramClipTooLargeError);
  });

  it("stops an unbounded stream as soon as cumulative bytes exceed the cap", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(responseWithChunks([3, 3]));

    await expect(
      downloadInstagramClip("https://scontent.cdninstagram.com/clip.mp4", {
        maxBytes: 5,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(InstagramClipTooLargeError);
  });

  it("aborts a download that exceeds the overall deadline", async () => {
    const fetchImpl = vi.fn(
      (_url: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ) as unknown as typeof fetch;

    await expect(
      downloadInstagramClip("https://scontent.cdninstagram.com/clip.mp4", {
        timeoutMs: 5,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(InstagramDownloadTimeoutError);
  });

  it("revalidates redirects and rejects a hop to a private address", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://127.0.0.1/internal" },
      }),
    );

    await expect(
      downloadInstagramClip("https://scontent.cdninstagram.com/clip.mp4", {
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(InstagramDownloadError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects a provider-supplied URL outside Instagram's CDN boundary", async () => {
    const fetchImpl = vi.fn();

    await expect(
      downloadInstagramClip("https://attacker.example/clip.mp4", { fetchImpl }),
    ).rejects.toBeInstanceOf(InstagramDownloadError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
