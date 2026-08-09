import { describe, expect, it } from "vitest";
import {
  buildCaptionMessages,
  parseCaptions,
} from "@/lib/publish/caption-prompt";
import type { PublishPlatform } from "@/lib/db/schema";

const body = (captions: unknown) => JSON.stringify({ captions });

const caption = (platform: string, over: Record<string, unknown> = {}) => ({
  platform,
  title: "A title",
  body: "A body",
  hashtags: ["celpip"],
  ...over,
});

describe("buildCaptionMessages", () => {
  it("asks only for the platforms being posted to", () => {
    const { system } = buildCaptionMessages({
      title: "T",
      platforms: ["instagram"],
    });
    expect(system).toContain("instagram");
    expect(system).not.toContain("youtube");
  });

  /** The captions should be one idea shaped three ways. Without saying so, the
   * model happily returns the same sentences relabelled. */
  it("forbids reusing the same wording across platforms", () => {
    const { system } = buildCaptionMessages({
      title: "T",
      platforms: ["youtube", "instagram"],
    });
    expect(system).toMatch(/same sentences under\s+different platforms/);
  });

  it("carries each platform's visible-character budget into the prompt", () => {
    const { system } = buildCaptionMessages({
      title: "T",
      platforms: ["instagram", "tiktok"],
    });
    // Instagram collapses at 125, TikTok at 90.
    expect(system).toContain("125 characters");
    expect(system).toContain("90 characters");
  });

  it("includes the creator's standing context when there is one", () => {
    const { system } = buildCaptionMessages({
      title: "T",
      platforms: ["youtube"],
      context: "PROJECT: CELPIP Speaking",
    });
    expect(system).toContain("CELPIP Speaking");
  });

  /** The script is what the video actually says, and is the difference between
   * a caption about this video and a caption about its title. */
  it("sends the script and the creator's own words", () => {
    const { user } = buildCaptionMessages({
      title: "T",
      platforms: ["youtube"],
      script: "the words I say",
      originalNote: "my rough thought",
    });
    expect(user).toContain("the words I say");
    expect(user).toContain("my rough thought");
  });

  /** The caption sits beside the video rather than narrating it, so repeating
   * the on-screen opening wastes the one line anyone reads. */
  it("names the hook as something not to repeat", () => {
    const { user } = buildCaptionMessages({
      title: "T",
      platforms: ["youtube"],
      hook: "POV: the timer starts",
    });
    expect(user).toContain("do not repeat");
    expect(user).toContain("POV: the timer starts");
  });

  it("passes style samples per platform, not globally", () => {
    const { user } = buildCaptionMessages({
      title: "T",
      platforms: ["youtube", "instagram"],
      styleSamples: { instagram: ["my ig voice"] },
    });
    expect(user).toContain("my ig voice");
    expect(user).toContain("Instagram Reels");
    expect(user).not.toContain("YouTube Shorts captions");
  });

  it("falls back to a platform rather than asking for nothing", () => {
    const { system } = buildCaptionMessages({ title: "T", platforms: [] });
    expect(system).toContain("youtube");
  });
});

describe("parseCaptions", () => {
  it("returns one caption per requested platform, in order", () => {
    const out = parseCaptions(
      body([caption("instagram"), caption("youtube")]),
      ["youtube", "instagram"],
    );
    expect(out.map((c) => c.platform)).toEqual(["youtube", "instagram"]);
  });

  it("drops platforms that were not asked for", () => {
    const out = parseCaptions(body([caption("youtube"), caption("tiktok")]), [
      "youtube",
    ]);
    expect(out).toHaveLength(1);
  });

  /** Only YouTube has a title field. Storing one for the others would surface
   * a value with nowhere to go and tempt the UI into rendering it. */
  it("blanks the title on platforms that have none", () => {
    const out = parseCaptions(body([caption("instagram")]), ["instagram"]);
    expect(out[0].title).toBe("");
    expect(out[0].body).toBe("A body");
  });

  /** The platforms reject an over-length field outright rather than trimming
   * it, so an unclamped title fails the upload itself. */
  it("clamps a title to the platform limit at a word boundary", () => {
    const long = `${"word ".repeat(40)}end`;
    const out = parseCaptions(body([caption("youtube", { title: long })]), [
      "youtube",
    ]);
    expect(out[0].title.length).toBeLessThanOrEqual(100);
    expect(out[0].title.endsWith(" ")).toBe(false);
    // Cut at a boundary, so the last token is a whole word.
    expect(out[0].title).toMatch(/word$/);
  });

  it("cuts hard when there is no usable word boundary", () => {
    const out = parseCaptions(
      body([caption("youtube", { title: "x".repeat(200) })]),
      ["youtube"],
    );
    expect(out[0].title).toHaveLength(100);
  });

  it("normalizes hashtags and drops duplicates", () => {
    const out = parseCaptions(
      body([
        caption("youtube", { hashtags: ["#celpip", "celpip", " #ielts ", ""] }),
      ]),
      ["youtube"],
    );
    expect(out[0].hashtags).toEqual(["celpip", "ielts"]);
  });

  it("caps hashtags at the platform's ceiling", () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag${i}`);
    const out = parseCaptions(body([caption("tiktok", { hashtags: many })]), [
      "tiktok",
    ]);
    expect(out[0].hashtags).toHaveLength(5);
  });

  it("skips an entry with neither a title nor a body", () => {
    const out = parseCaptions(
      body([caption("youtube", { title: "", body: "" }), caption("instagram")]),
      ["youtube", "instagram"],
    );
    expect(out.map((c) => c.platform)).toEqual(["instagram"]);
  });

  /** The route charges only when this returns, so an empty result has to
   * throw rather than bill for nothing. */
  it("throws when nothing usable came back", () => {
    expect(() => parseCaptions(body([]), ["youtube"])).toThrow("caption_empty");
    expect(() => parseCaptions("{}", ["youtube"])).toThrow("caption_empty");
    expect(() =>
      parseCaptions(body([caption("tiktok")]), [
        "youtube",
      ] as PublishPlatform[]),
    ).toThrow("caption_empty");
  });

  it("throws on output that is not JSON", () => {
    expect(() => parseCaptions("no json", ["youtube"])).toThrow(
      "caption_unparseable",
    );
    expect(() => parseCaptions("{ broken", ["youtube"])).toThrow(
      "caption_unparseable",
    );
  });

  it("tolerates prose around the JSON", () => {
    const out = parseCaptions(
      `Sure! ${body([caption("youtube")])} hope that helps`,
      ["youtube"],
    );
    expect(out).toHaveLength(1);
  });
});
