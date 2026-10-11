import { describe, expect, it } from "vitest";
import { creatorCacheKey, referenceCacheKey } from "./scrape-cache-key";

describe("referenceCacheKey", () => {
  it("keys posts by their platform id, ignoring share tracking", () => {
    expect(
      referenceCacheKey(
        "https://www.instagram.com/reel/ABC123/?igsh=xyz&utm_source=ig",
      ),
    ).toBe("resolve:instagram:ABC123");
    expect(
      referenceCacheKey(
        "https://www.tiktok.com/@someone/video/7312345678?lang=en",
      ),
    ).toBe("resolve:tiktok:7312345678");
    expect(referenceCacheKey("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe(
      "resolve:youtube:dQw4w9WgXcQ",
    );
    expect(
      referenceCacheKey("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"),
    ).toBe("resolve:youtube:dQw4w9WgXcQ");
  });

  it("refuses anything the fetcher might read differently", () => {
    for (const url of [
      "https://www.instagram.com/reel/ABC123/?other=1",
      "https://user:pw@www.instagram.com/reel/ABC123/",
      "https://www.instagram.com:8443/reel/ABC123/",
      "https://evil.example/reel/ABC123/",
      "https://instagram.com.evil.example/reel/ABC123/",
      "https://www.instagram.com/reel/ABC123/extra",
      "https://vm.tiktok.com/ZMabc/",
      "https://www.youtube.com/watch?v=short",
      "not a url",
    ]) {
      expect(referenceCacheKey(url), url).toBeNull();
    }
  });
});

describe("creatorCacheKey", () => {
  it("keys Instagram and TikTok handles case-insensitively", () => {
    expect(creatorCacheKey("https://www.instagram.com/Some.One/")).toBe(
      "creator:instagram:some.one",
    );
    expect(creatorCacheKey("https://www.tiktok.com/@Someone?lang=en")).toBe(
      "creator:tiktok:someone",
    );
  });

  it("never caches YouTube, whose feed is read with the user's own token", () => {
    expect(creatorCacheKey("https://www.youtube.com/@someone")).toBeNull();
  });
});
