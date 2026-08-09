import { describe, expect, it } from "vitest";
import { captionFits, renderCaption } from "@/lib/publish/caption";
import type { PlatformCaption } from "@/lib/publish/caption-prompt";

const caption = (over: Partial<PlatformCaption> = {}): PlatformCaption => ({
  platform: "instagram",
  title: "",
  body: "A caption body",
  hashtags: [],
  ...over,
});

describe("renderCaption", () => {
  it("is just the body when there are no hashtags", () => {
    expect(renderCaption(caption())).toBe("A caption body");
  });

  /** Tags on their own line so they read as tags. Run into the body they look
   * like a sentence that trailed off into keywords. */
  it("puts hashtags on their own line, each with one hash", () => {
    expect(renderCaption(caption({ hashtags: ["celpip", "ielts"] }))).toBe(
      "A caption body\n\n#celpip #ielts",
    );
  });

  it("collapses cleanly when the body is empty", () => {
    expect(renderCaption(caption({ body: "  ", hashtags: ["celpip"] }))).toBe(
      "#celpip",
    );
  });
});

describe("captionFits", () => {
  it("accepts a caption inside the platform's limits", () => {
    expect(captionFits(caption())).toBe(true);
  });

  /** Measured on the RENDERED text, not the body alone: the hashtags are part
   * of what gets posted, and a body that only fits without them would be
   * rejected at upload. */
  it("counts the hashtags against the limit", () => {
    const tags = Array.from({ length: 8 }, () => "x".repeat(300));
    expect(
      captionFits(caption({ body: "x".repeat(2000), hashtags: tags })),
    ).toBe(false);
  });

  it("holds YouTube to its shorter title limit", () => {
    expect(
      captionFits(caption({ platform: "youtube", title: "t".repeat(101) })),
    ).toBe(false);
    expect(
      captionFits(caption({ platform: "youtube", title: "t".repeat(100) })),
    ).toBe(true);
  });
});
