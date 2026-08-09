import { describe, expect, it } from "vitest";
import {
  addHashtags,
  blankCaption,
  captionOverBy,
  hasCaptionText,
  removeHashtag,
  toHashtag,
  visibleSplit,
  writtenPlatforms,
} from "@/components/publish/captions/caption-draft";
import type { PlatformCaption } from "@/lib/publish/caption";

const caption = (over: Partial<PlatformCaption> = {}): PlatformCaption => ({
  ...blankCaption("instagram"),
  ...over,
});

describe("toHashtag", () => {
  it("strips the hash so renderCaption does not double it", () => {
    expect(toHashtag("#running")).toBe("running");
    expect(toHashtag("###running")).toBe("running");
  });

  it("drops separators and punctuation", () => {
    expect(toHashtag("half marathon!")).toBe("halfmarathon");
    expect(toHashtag("_keeps_underscores_")).toBe("_keeps_underscores_");
  });

  it("keeps non-latin letters", () => {
    expect(toHashtag("#koşu")).toBe("koşu");
  });
});

describe("addHashtags", () => {
  it("splits a pasted run of tags", () => {
    expect(addHashtags([], "#one #two, three")).toEqual([
      "one",
      "two",
      "three",
    ]);
  });

  it("ignores duplicates and blanks", () => {
    expect(addHashtags(["one"], "  one   #!!  two ")).toEqual(["one", "two"]);
  });

  it("leaves the list alone when nothing usable was typed", () => {
    expect(addHashtags(["one"], "  ##  ")).toEqual(["one"]);
  });
});

describe("removeHashtag", () => {
  it("removes only the named tag", () => {
    expect(removeHashtag(["one", "two"], "one")).toEqual(["two"]);
  });
});

describe("visibleSplit", () => {
  it("cuts at the platform's visible budget, not its accepted length", () => {
    const body = "a".repeat(200);
    const { shown, hidden } = visibleSplit(caption({ body }));
    // Instagram collapses after 125 characters.
    expect(shown).toHaveLength(125);
    expect(hidden).toHaveLength(75);
  });

  it("counts the hashtag line, because the platform does", () => {
    const { shown, hidden } = visibleSplit(
      caption({ platform: "tiktok", body: "b".repeat(88), hashtags: ["run"] }),
    );
    expect(shown).toHaveLength(90);
    expect(hidden).toBe("#run");
  });

  it("has nothing hidden when the caption fits in the preview", () => {
    expect(visibleSplit(caption({ body: "short" })).hidden).toBe("");
  });
});

describe("captionOverBy", () => {
  it("reports zero for a caption the platform accepts", () => {
    expect(captionOverBy(caption({ body: "fine" }))).toEqual({
      title: 0,
      body: 0,
    });
  });

  it("measures the rendered body, tags included", () => {
    const over = captionOverBy(
      caption({ body: "c".repeat(2200), hashtags: ["run"] }),
    );
    // 2200 body + "\n\n" + "#run" against Instagram's 2200 ceiling.
    expect(over.body).toBe(6);
  });

  it("measures a YouTube title against its own ceiling", () => {
    const over = captionOverBy(
      caption({ platform: "youtube", title: "t".repeat(105) }),
    );
    expect(over.title).toBe(5);
  });
});

describe("hasCaptionText", () => {
  it("treats whitespace as unwritten", () => {
    expect(hasCaptionText(caption({ body: "   " }))).toBe(false);
    expect(hasCaptionText(caption({ hashtags: ["run"] }))).toBe(true);
  });
});

describe("writtenPlatforms", () => {
  it("counts only the platforms that actually have copy", () => {
    expect(
      writtenPlatforms({
        youtube: caption({ platform: "youtube", body: "hi" }),
        tiktok: blankCaption("tiktok"),
      }),
    ).toBe(1);
    expect(writtenPlatforms(undefined)).toBe(0);
  });
});
