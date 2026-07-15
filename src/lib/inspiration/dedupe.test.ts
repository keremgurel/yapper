import { describe, expect, it } from "vitest";
import {
  findDuplicateInspoItem,
  normalizeInspoUrl,
} from "@/lib/inspiration/dedupe";
import type { InspirationItem } from "@/lib/inspiration/types";

function item(id: string, url: string): InspirationItem {
  return {
    id,
    kind: "video",
    pillarId: null,
    url,
    platform: "youtube",
    title: id,
    createdAt: 0,
  };
}

describe("normalizeInspoUrl", () => {
  it("ignores www, a trailing slash, host case, and a fragment", () => {
    expect(normalizeInspoUrl("https://WWW.YouTube.com/@creator/")).toBe(
      "https://youtube.com/@creator",
    );
    expect(normalizeInspoUrl("https://youtube.com/@creator#top")).toBe(
      "https://youtube.com/@creator",
    );
  });

  it("keeps the query, so different videos stay different", () => {
    expect(normalizeInspoUrl("https://youtube.com/watch?v=AAA")).not.toBe(
      normalizeInspoUrl("https://youtube.com/watch?v=BBB"),
    );
  });

  it("keeps path case (video ids are case-sensitive)", () => {
    expect(normalizeInspoUrl("https://youtube.com/watch?v=Ab")).not.toBe(
      normalizeInspoUrl("https://youtube.com/watch?v=ab"),
    );
  });

  it("falls back to a trimmed compare for a non-URL", () => {
    expect(normalizeInspoUrl("  @Handle ")).toBe("@handle");
  });
});

describe("findDuplicateInspoItem", () => {
  const items = [
    item("a", "https://www.tiktok.com/@me/video/123"),
    item("b", "https://youtube.com/watch?v=AAA"),
  ];

  it("matches across www and a trailing slash", () => {
    expect(
      findDuplicateInspoItem(items, "https://tiktok.com/@me/video/123/")?.id,
    ).toBe("a");
  });

  it("does not match a different video on the same host", () => {
    expect(
      findDuplicateInspoItem(items, "https://youtube.com/watch?v=ZZZ"),
    ).toBeNull();
  });

  it("is null against an empty library", () => {
    expect(
      findDuplicateInspoItem([], "https://youtube.com/watch?v=AAA"),
    ).toBeNull();
  });
});
