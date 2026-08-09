import { describe, expect, it } from "vitest";
import {
  linkAt,
  linkEndingAt,
  linkSpans,
  linksIn,
} from "@/lib/inspiration/link-spans";

describe("linkSpans", () => {
  it("keeps a link where it was typed", () => {
    const spans = linkSpans("watch https://a.com then read");
    expect(spans.map((s) => s.text)).toEqual([
      "watch ",
      "https://a.com",
      " then read",
    ]);
    expect(spans[1].isLink).toBe(true);
  });

  it("ends a link before the sentence's punctuation", () => {
    // The comma belongs to the sentence far more often than to the URL.
    expect(linksIn("see https://a.com, then go")).toEqual(["https://a.com"]);
  });

  it("finds every link, not just the first", () => {
    expect(linksIn("https://a.com and https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("treats prose with no links as one span", () => {
    const spans = linkSpans("just a thought");
    expect(spans).toHaveLength(1);
    expect(spans[0].isLink).toBe(false);
  });

  it("reports where each span sits, so the caret can be reasoned about", () => {
    const [, link] = linkSpans("hi https://a.com");
    expect(link.start).toBe(3);
    expect(link.end).toBe(16);
  });
});

describe("linkEndingAt", () => {
  const text = "watch https://a.com now";

  it("finds the link the caret is just after", () => {
    expect(linkEndingAt(text, 19)?.text).toBe("https://a.com");
  });

  it("finds nothing mid-link or in the prose", () => {
    expect(linkEndingAt(text, 12)).toBeNull();
    expect(linkEndingAt(text, 23)).toBeNull();
  });
});

describe("linkAt", () => {
  it("finds a link the caret is inside", () => {
    expect(linkAt("a https://a.com b", 8)?.text).toBe("https://a.com");
    expect(linkAt("a https://a.com b", 17)).toBeNull();
  });
});
