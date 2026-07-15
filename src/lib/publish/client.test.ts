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

  it("resolves to a safe empty result when the request rejects", async () => {
    // A network error (offline, DNS, CORS) rejects fetch. The videos hook keys
    // loading off `videos === null`, so a rejection here would spin forever.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(fetchYouTubeVideos()).resolves.toEqual({
      connected: false,
      videos: [],
    });
  });

  it("resolves to empty when the body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      }),
    );
    await expect(fetchYouTubeVideos()).resolves.toEqual({
      connected: false,
      videos: [],
    });
  });

  it("resolves to empty on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchYouTubeVideos()).resolves.toEqual({
      connected: false,
      videos: [],
    });
  });
});
