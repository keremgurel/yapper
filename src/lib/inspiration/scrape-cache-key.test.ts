import { describe, expect, it } from "vitest";
import { scrapeCacheKey } from "./scrape-cache-key";

describe("scrapeCacheKey", () => {
  it("drops share tracking, www and trailing slashes", () => {
    expect(
      scrapeCacheKey(
        "resolve",
        "https://www.instagram.com/reel/ABC123/?igsh=xyz&utm_source=ig",
      ),
    ).toBe("resolve:instagram.com/reel/ABC123");
  });

  it("keeps the YouTube video id", () => {
    expect(
      scrapeCacheKey("resolve", "https://m.youtube.com/watch?v=dQw4&t=42"),
    ).toBe("resolve:youtube.com/watch?v=dQw4");
  });

  it("keeps path case, which some platforms treat as the id", () => {
    expect(
      scrapeCacheKey("resolve", "https://instagram.com/reel/AbC"),
    ).not.toBe(scrapeCacheKey("resolve", "https://instagram.com/reel/abc"));
  });

  it("separates kinds and refuses junk", () => {
    expect(scrapeCacheKey("creator", "https://tiktok.com/@me")).toBe(
      "creator:tiktok.com/@me",
    );
    expect(scrapeCacheKey("resolve", "not a url")).toBeNull();
    expect(scrapeCacheKey("resolve", "javascript:alert(1)")).toBeNull();
  });
});
