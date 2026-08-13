import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveInstagramSourceFile } from "./instagram-source-file";

const resolveInstagramMedia = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inspiration/apify", () => ({ resolveInstagramMedia }));

describe("resolveInstagramSourceFile", () => {
  const media = {
    mediaUrl: "https://cdn.instagram/file.mp4",
    permalink: "https://www.instagram.com/reel/abc/",
    title: "A reel",
  };

  beforeEach(() => resolveInstagramMedia.mockReset());

  it("uses the Graph file URL and never scrapes", async () => {
    await expect(resolveInstagramSourceFile(media)).resolves.toBe(
      "https://cdn.instagram/file.mp4",
    );
    expect(resolveInstagramMedia).not.toHaveBeenCalled();
  });

  // The licensed-audio case: Graph withholds the file, the permalink still has it.
  it("falls back to the permalink when Graph withheld the file", async () => {
    resolveInstagramMedia.mockResolvedValue({
      mediaUrl: "https://scontent.cdninstagram.com/scraped.mp4",
    });
    await expect(
      resolveInstagramSourceFile({ ...media, mediaUrl: null }),
    ).resolves.toBe("https://scontent.cdninstagram.com/scraped.mp4");
    expect(resolveInstagramMedia).toHaveBeenCalledWith(media.permalink);
  });

  it("reports no source file when neither route yields one", async () => {
    resolveInstagramMedia.mockResolvedValue({ mediaUrl: undefined });
    await expect(
      resolveInstagramSourceFile({ ...media, mediaUrl: null }),
    ).rejects.toThrow("no_source_file");
  });

  it("propagates the route deadline through the permalink fallback", async () => {
    const controller = new AbortController();
    resolveInstagramMedia.mockResolvedValue({
      mediaUrl: "https://scontent.cdninstagram.com/scraped.mp4",
    });

    await resolveInstagramSourceFile(
      { ...media, mediaUrl: null },
      controller.signal,
    );

    expect(resolveInstagramMedia).toHaveBeenCalledWith(
      media.permalink,
      controller.signal,
    );
  });

  it("does not scrape without a permalink", async () => {
    await expect(
      resolveInstagramSourceFile({ ...media, mediaUrl: null, permalink: "" }),
    ).rejects.toThrow("no_source_file");
    expect(resolveInstagramMedia).not.toHaveBeenCalled();
  });
});
