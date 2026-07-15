import { describe, expect, it } from "vitest";
import { decodeEntities } from "@/lib/inspiration/html-entities";

describe("decodeEntities", () => {
  it("decodes the common named entities", () => {
    expect(decodeEntities("Tips &amp; Tricks")).toBe("Tips & Tricks");
    expect(decodeEntities("a &lt;b&gt; c")).toBe("a <b> c");
    expect(decodeEntities("say &quot;hi&quot;")).toBe('say "hi"');
    expect(decodeEntities("it&apos;s")).toBe("it's");
  });

  it("decodes decimal and hex numeric references", () => {
    expect(decodeEntities("it&#39;s")).toBe("it's");
    expect(decodeEntities("it&#x27;s")).toBe("it's");
    // A code point above the BMP (an emoji) must round-trip.
    expect(decodeEntities("fire &#x1F525;")).toBe("fire \u{1F525}");
  });

  it("leaves unknown entities and out-of-range references untouched", () => {
    expect(decodeEntities("a &notareal; b")).toBe("a &notareal; b");
    expect(decodeEntities("&#x110000;")).toBe("&#x110000;");
    expect(decodeEntities("plain text")).toBe("plain text");
  });

  it("decodes several entities in one string", () => {
    expect(decodeEntities("Ben &amp; Jerry&#39;s &quot;best&quot;")).toBe(
      'Ben & Jerry\'s "best"',
    );
  });
});
