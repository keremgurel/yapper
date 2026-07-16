import { describe, expect, it } from "vitest";
import { metaTag } from "@/lib/inspiration/oembed";

describe("metaTag", () => {
  it("reads a simple og:title", () => {
    const html = `<meta property="og:title" content="Clean title">`;
    expect(metaTag(html, "og:title")).toBe("Clean title");
  });

  it("keeps a raw apostrophe inside a double-quoted value", () => {
    // The apostrophe is not the delimiter, so the value must not stop at it.
    const html = `<meta property="og:title" content="Mom's Best Recipe">`;
    expect(metaTag(html, "og:title")).toBe("Mom's Best Recipe");
  });

  it("keeps a raw double quote inside a single-quoted value", () => {
    const html = `<meta property='og:title' content='She said "hi"'>`;
    expect(metaTag(html, "og:title")).toBe('She said "hi"');
  });

  it("reads the content attribute when it precedes the property attribute", () => {
    const html = `<meta content="Ben's page" property="og:site_name">`;
    expect(metaTag(html, "og:site_name")).toBe("Ben's page");
  });

  it("decodes HTML entities in the value", () => {
    const html = `<meta property="og:title" content="Tips &amp; Tricks &#39;n more">`;
    expect(metaTag(html, "og:title")).toBe("Tips & Tricks 'n more");
  });

  it("returns undefined when the tag is absent", () => {
    expect(metaTag("<html></html>", "og:title")).toBeUndefined();
  });
});
