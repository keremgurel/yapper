import { afterEach, describe, expect, it, vi } from "vitest";
import { listYouTubeVideos } from "./youtube-list";
import { listTikTokVideos } from "./tiktok-list";
import { listInstagramVideos } from "./instagram-list";
afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown) => Promise.resolve(Response.json(body));
describe("connected video history budgets", () => {
  it("paginates YouTube to 200, with IDs batched in groups of 50", async () => {
    const fetcher = vi.fn((url: string) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith("channels"))
        return json({
          items: [
            { contentDetails: { relatedPlaylists: { uploads: "mine" } } },
          ],
        });
      if (parsed.pathname.endsWith("playlistItems")) {
        expect(parsed.searchParams.get("maxResults")).toBe("50");
        const page = Number(parsed.searchParams.get("pageToken") ?? 0);
        return json({
          items: Array.from({ length: 50 }, (_, i) => ({
            contentDetails: { videoId: String(page * 50 + i) },
          })),
          nextPageToken: String(page + 1),
        });
      }
      const ids = parsed.searchParams.get("id")!.split(",");
      expect(ids).toHaveLength(50);
      return json({ items: ids.map((id) => ({ id, snippet: { title: id } })) });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await listYouTubeVideos("token")).toHaveLength(200);
    expect(fetcher).toHaveBeenCalledTimes(9);
  });
  it("stops on a repeated YouTube cursor", async () => {
    const fetcher = vi.fn((url: string) =>
      url.includes("channels?")
        ? json({
            items: [
              { contentDetails: { relatedPlaylists: { uploads: "mine" } } },
            ],
          })
        : url.includes("playlistItems?")
          ? json({
              items: [{ contentDetails: { videoId: "one" } }],
              nextPageToken: "same",
            })
          : json({ items: [{ id: "one" }] }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await listYouTubeVideos("token")).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("paginates TikTok in pages of 20 and stops at 100", async () => {
    let page = 0;
    const fetcher = vi.fn((_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.max_count).toBe(20);
      if (page) expect(body.cursor).toBe(page);
      const videos = Array.from({ length: 20 }, (_, i) => ({
        id: String(page * 20 + i),
      }));
      page++;
      return json({ data: { videos, cursor: page, has_more: true } });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await listTikTokVideos("token")).toHaveLength(100);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("does not silently return a partial list after a later page fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() =>
          json({
            data: { videos: [{ id: "one" }], cursor: 1, has_more: true },
          }),
        )
        .mockImplementationOnce(() =>
          Promise.resolve(new Response("", { status: 429 })),
        ),
    );
    await expect(listTikTokVideos("token")).rejects.toThrow(
      "tiktok_video_list_429",
    );
  });
  it("caps Instagram at 100 media and five concurrent insights calls", async () => {
    let pending = 0;
    let maximum = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/me/media")) {
          expect(new URL(url).searchParams.get("limit")).toBe("100");
          return Response.json({
            data: Array.from({ length: 12 }, (_, i) => ({
              id: String(i),
              media_type: "VIDEO",
            })),
          });
        }
        pending++;
        maximum = Math.max(maximum, pending);
        await new Promise((resolve) => setTimeout(resolve, 1));
        pending--;
        return Response.json({ data: [{ values: [{ value: 42 }] }] });
      }),
    );
    const videos = await listInstagramVideos("token", 500);
    expect(videos).toHaveLength(12);
    expect(videos[0].viewCount).toBe(42);
    expect(maximum).toBe(5);
  });
});
