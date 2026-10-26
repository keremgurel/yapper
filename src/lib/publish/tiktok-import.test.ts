import { afterEach, expect, it, vi } from "vitest";
import {
  directTikTokSourceFromHtml,
  fetchTikTokMediaForImport,
} from "./tiktok-import";
import { assertSafeRemoteUrl } from "./instagram-import";
import { TIKTOK_MEDIA_DOMAINS } from "./tiktok-import";
afterEach(() => vi.unstubAllGlobals());
it("only reads the requested video's embedded metadata", () => {
  const html = (id: string) =>
    `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.video-detail": { itemInfo: { itemStruct: { id, video: { playAddr: "https://v.tiktokcdn.com/file.mp4" } } } } } })}</script>`;
  expect(directTikTokSourceFromHtml(html("123"), "123")).toBe(
    "https://v.tiktokcdn.com/file.mp4",
  );
  expect(directTikTokSourceFromHtml(html("456"), "123")).toBeNull();
  expect(directTikTokSourceFromHtml("challenge page", "123")).toBeNull();
});
it("blocks unowned posts even if the response contains another video", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        data: {
          videos: [
            {
              id: "456",
              share_url: "https://www.tiktok.com/@other/video/456",
            },
          ],
        },
        error: { code: "ok" },
      }),
    ),
  );
  await expect(
    fetchTikTokMediaForImport("token", "123", new AbortController().signal),
  ).rejects.toThrow("not_owned");
});
it("uses the canonical share URL from the authenticated lookup, not a caller's URL", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        data: {
          videos: [
            {
              id: "123",
              title: "My video",
              share_url:
                "https://www.tiktok.com/@owner/video/123?tracking=ignored",
            },
          ],
        },
        error: { code: "ok" },
      }),
    ),
  );
  await expect(
    fetchTikTokMediaForImport("token", "123", new AbortController().signal),
  ).resolves.toEqual({
    title: "My video",
    url: "https://www.tiktok.com/@owner/video/123",
  });
});
it("allows only explicit media hosts and rejects private addresses and lookalikes", () => {
  for (const url of [
    "https://127.0.0.1/file",
    "http://v.tiktokcdn.com/file",
    "https://tiktokcdn.com.attacker.com/file",
    "https://attacker.com/file",
  ])
    expect(() => assertSafeRemoteUrl(url, TIKTOK_MEDIA_DOMAINS)).toThrow();
  expect(
    assertSafeRemoteUrl(
      "https://v.tiktokcdn.com/file.mp4",
      TIKTOK_MEDIA_DOMAINS,
    ).hostname,
  ).toBe("v.tiktokcdn.com");
});

it("sends the Apify credential only to an approved record URL, never to a redirected CDN", async () => {
  const { tiktokDownloadHeaders } = await import("./tiktok-import");
  const { downloadInstagramClip } = await import("./instagram-import");
  vi.stubEnv("APIFY_TOKEN", "test-token");
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://v.tiktokcdn.com/file.mp4" },
      }),
    )
    .mockResolvedValueOnce(
      new Response("video-bytes", { headers: { "content-type": "video/mp4" } }),
    );
  const clip = await downloadInstagramClip(
    "https://api.apify.com/v2/key-value-stores/store/records/video.mp4",
    {
      allowedDomains: TIKTOK_MEDIA_DOMAINS,
      headersForUrl: tiktokDownloadHeaders,
      fetchImpl,
    },
  );
  try {
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer test-token",
    });
    expect(fetchImpl.mock.calls[1][1].headers).toBeUndefined();
  } finally {
    await clip.cleanup();
    vi.unstubAllEnvs();
  }
});
