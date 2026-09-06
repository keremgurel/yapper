import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYouTubeVideos } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchYouTubeVideos", () => {
  it("returns the parsed body on success", async () => {
    const body = { connected: true, videos: [] };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }),
    );
    await expect(fetchYouTubeVideos()).resolves.toEqual(body);
  });

  it("preserves a network failure instead of reporting a disconnected empty account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(fetchYouTubeVideos()).rejects.toThrow();
  });

  it("preserves an invalid response as a load failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      }),
    );
    await expect(fetchYouTubeVideos()).rejects.toThrow();
  });

  it("rejects an unsuccessful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchYouTubeVideos()).rejects.toThrow();
  });
});
