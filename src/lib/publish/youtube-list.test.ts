import { afterEach, expect, it, vi } from "vitest";
import { listYouTubeVideos } from "./youtube-list";

afterEach(() => vi.unstubAllGlobals());

it("carries the original YouTube description into Poster without replacing the title", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          items: [
            { contentDetails: { relatedPlaylists: { uploads: "uploads" } } },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ items: [{ contentDetails: { videoId: "post-1" } }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          items: [
            {
              id: "post-1",
              snippet: {
                title: "Original title",
                description: "Original description\n#tag",
              },
            },
          ],
        }),
      ),
  );
  expect(await listYouTubeVideos("token")).toEqual([
    expect.objectContaining({
      id: "post-1",
      title: "Original title",
      caption: "Original description\n#tag",
    }),
  ]);
});
