import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/costs/provider-budget", () => ({
  guardProviderEgress: vi.fn(),
}));
import { resolveTikTokImportMedia } from "./apify";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("makes exactly one bounded actor request without related content or paid extras", async () => {
  vi.stubEnv("APIFY_TOKEN", "test-token");
  const fetch = vi.fn().mockResolvedValue(
    Response.json([
      {
        id: "123",
        mediaUrls: [
          "https://api.apify.com/v2/key-value-stores/store/records/video.mp4",
        ],
      },
    ]),
  );
  vi.stubGlobal("fetch", fetch);
  await resolveTikTokImportMedia(
    "https://www.tiktok.com/@owner/video/123",
    new AbortController().signal,
  );
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0];
  expect(new URL(url).searchParams.get("maxTotalChargeUsd")).toBe("0.02");
  expect(JSON.parse(init.body)).toMatchObject({
    postURLs: ["https://www.tiktok.com/@owner/video/123"],
    scrapeRelatedVideos: false,
    resultsPerPage: 1,
    shouldDownloadVideos: true,
    shouldDownloadCovers: false,
    downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
  });
});
