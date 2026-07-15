import { describe, expect, it } from "vitest";
import {
  creatorScrapePatch,
  isScrapeFailure,
} from "@/lib/inspiration/creator-scrape";

describe("isScrapeFailure", () => {
  it("is a success only for an ok response with no error note", () => {
    expect(isScrapeFailure(true, { videos: [] })).toBe(false);
  });

  it("fails on a non-ok response", () => {
    expect(isScrapeFailure(false, { videos: [] })).toBe(true);
  });

  it("fails when the soft-200 body carries an error note", () => {
    // The route returns HTTP 200 with {error} on a scraper failure. Treating
    // that as an empty success is the bug: it stamps scrapedAt and hides retry.
    expect(isScrapeFailure(true, { videos: [], error: "apify_429" })).toBe(
      true,
    );
  });
});

describe("creatorScrapePatch", () => {
  const now = 1000;

  it("records the feed and the scrape time", () => {
    const video = {
      url: "v",
      title: "V",
      views: 9,
      likes: 1,
      comments: 0,
    };
    const patch = creatorScrapePatch(
      { videos: [video], scrapedAt: 42 },
      { title: "@who" },
      now,
    );
    expect(patch.videos).toEqual([video]);
    expect(patch.scrapedAt).toBe(42);
  });

  it("defaults an empty feed and stamps the time when the route omits it", () => {
    const patch = creatorScrapePatch({}, { title: "Someone" }, now);
    expect(patch.videos).toEqual([]);
    expect(patch.scrapedAt).toBe(now);
  });

  it("backfills the avatar only when the creator has no thumbnail", () => {
    expect(
      creatorScrapePatch({ avatar: "a.jpg" }, { title: "x" }, now).thumbnail,
    ).toBe("a.jpg");
    expect(
      creatorScrapePatch(
        { avatar: "a.jpg" },
        { title: "x", thumbnail: "have.jpg" },
        now,
      ).thumbnail,
    ).toBeUndefined();
  });

  it("replaces a raw @handle title with the scraped name, but leaves a real title", () => {
    expect(
      creatorScrapePatch({ name: "Jane Doe" }, { title: "@jane" }, now).title,
    ).toBe("Jane Doe");
    expect(
      creatorScrapePatch({ name: "Jane Doe" }, { title: "Jane" }, now).title,
    ).toBeUndefined();
  });
});
