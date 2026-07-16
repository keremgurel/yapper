import { describe, expect, it } from "vitest";
import {
  extractHeadings,
  getRelatedBlogPosts,
  type BlogPostMeta,
} from "@/lib/blog";

const post = (over: Partial<BlogPostMeta>): BlogPostMeta => ({
  slug: "s",
  title: "T",
  excerpt: "e",
  publishedAt: "2026-01-01",
  author: "a",
  category: "General",
  tags: [],
  featured: false,
  cover: null,
  readingTimeText: "1 min read",
  readingTimeMinutes: 1,
  headings: [],
  ...over,
});

describe("getRelatedBlogPosts", () => {
  const posts = [
    post({ slug: "cur", category: "A", tags: ["x", "y"] }),
    post({ slug: "p1", category: "A", tags: ["x"], publishedAt: "2026-01-05" }), // 3 + 1 = 4
    post({
      slug: "p2",
      category: "B",
      tags: ["x", "y"],
      publishedAt: "2026-01-10",
    }), // 0 + 2 = 2
    post({ slug: "p3", category: "A", tags: [], publishedAt: "2026-01-02" }), // 3
  ];

  it("ranks by shared category and tags, excluding the post itself", () => {
    const out = getRelatedBlogPosts("cur", posts);
    expect(out.map((p) => p.slug)).toEqual(["p1", "p3", "p2"]);
  });

  it("breaks score ties by most recent", () => {
    const tied = [
      post({ slug: "cur", category: "A" }),
      post({ slug: "old", category: "A", publishedAt: "2026-01-01" }),
      post({ slug: "new", category: "A", publishedAt: "2026-02-01" }),
    ];
    expect(getRelatedBlogPosts("cur", tied).map((p) => p.slug)).toEqual([
      "new",
      "old",
    ]);
  });

  it("returns nothing for an unknown slug and respects the limit", () => {
    expect(getRelatedBlogPosts("missing", posts)).toEqual([]);
    expect(getRelatedBlogPosts("cur", posts, 1).map((p) => p.slug)).toEqual([
      "p1",
    ]);
  });
});

describe("extractHeadings", () => {
  it("takes h2 and h3 only, with slug ids", () => {
    const out = extractHeadings("# Title\n## Section\n### Sub\n#### Deep");
    expect(out).toEqual([
      { id: "section", level: 2, text: "Section" },
      { id: "sub", level: 3, text: "Sub" },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const out = extractHeadings("## Real\n```\n## Fake\n```\n## Also");
    expect(out.map((h) => h.text)).toEqual(["Real", "Also"]);
  });

  it("strips inline markdown from the heading text", () => {
    const out = extractHeadings("## **Bold** and [a link](https://x.com)");
    expect(out[0].text).toBe("Bold and a link");
  });
});
