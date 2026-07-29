import { describe, expect, it } from "vitest";
import { deriveIdeaType } from "@/lib/ideas/derive-type";

describe("deriveIdeaType", () => {
  it("is original for words with no link", () => {
    expect(deriveIdeaType({ transcript: "a video about filler words" })).toBe(
      "original",
    );
  });

  it("is inspiration for a bare link", () => {
    expect(deriveIdeaType({ url: "https://tiktok.com/x" })).toBe("inspiration");
  });

  it("is semi-original for a link plus the creator's own words", () => {
    expect(
      deriveIdeaType({
        url: "https://instagram.com/reel/x",
        transcript: "do this but for CELPIP speaking",
      }),
    ).toBe("semi-original");
  });

  it("reads the link off source.url when url is absent", () => {
    expect(
      deriveIdeaType({ source: { url: "https://youtube.com/watch?v=x" } }),
    ).toBe("inspiration");
  });

  it("ignores blank/whitespace inputs", () => {
    expect(deriveIdeaType({ transcript: "   ", url: "  " })).toBe("original");
  });

  it("is semi-original when the words come with a resolved source", () => {
    expect(
      deriveIdeaType({
        transcript: "my angle on this",
        source: { url: "https://x.com/status/1", title: "A post" },
      }),
    ).toBe("semi-original");
  });
});
