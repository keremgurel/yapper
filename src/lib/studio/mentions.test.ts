import { describe, expect, it } from "vitest";
import {
  applyMention,
  mentionAt,
  mentionedNames,
  suggestMentions,
} from "@/lib/studio/mentions";

describe("mentionAt", () => {
  it("finds the mention the caret sits in", () => {
    const v = "show @redd";
    expect(mentionAt(v, v.length)).toEqual({ from: 5, to: 10, query: "redd" });
  });

  it("keeps the query when the name has a space in it", () => {
    const v = "put @my clip";
    expect(mentionAt(v, v.length)?.query).toBe("my clip");
  });

  it("offers everything the moment the @ is typed", () => {
    expect(mentionAt("@", 1)).toEqual({ from: 0, to: 1, query: "" });
  });

  it("is not fooled by an email address", () => {
    expect(mentionAt("mail me@example.com", 19)).toBeNull();
  });

  it("ends at a newline", () => {
    expect(mentionAt("@clip\nand then", 13)).toBeNull();
  });

  it("ignores an @ that comes after the caret", () => {
    expect(mentionAt("hello @clip", 5)).toBeNull();
  });

  it("takes the @ nearest the caret", () => {
    const v = "@a.mp4 and @b";
    expect(mentionAt(v, v.length)?.from).toBe(11);
  });
});

describe("suggestMentions", () => {
  const names = ["reddit.mp4", "blog.mp4", "my clip.mov"];

  it("offers the whole library for an empty query", () => {
    expect(suggestMentions(names, "")).toEqual(names);
  });

  it("matches anywhere in the name, ignoring case", () => {
    expect(suggestMentions(names, "DIT")).toEqual(["reddit.mp4"]);
    expect(suggestMentions(names, "clip")).toEqual(["my clip.mov"]);
  });

  it("offers nothing when nothing matches", () => {
    expect(suggestMentions(names, "zzz")).toEqual([]);
  });
});

describe("applyMention", () => {
  it("replaces what was typed and leaves the caret after the name", () => {
    const v = "show @redd";
    const span = mentionAt(v, v.length)!;
    expect(applyMention(v, span, "reddit.mp4")).toEqual({
      value: "show @reddit.mp4 ",
      caret: 17,
    });
  });

  it("keeps whatever followed the caret", () => {
    const v = "show @redd when I talk";
    const span = mentionAt(v, 10)!;
    expect(applyMention(v, span, "reddit.mp4").value).toBe(
      "show @reddit.mp4  when I talk",
    );
  });
});

describe("mentionedNames", () => {
  const names = ["reddit.mp4", "blog.mp4", "my clip.mov"];

  it("finds the files the text names", () => {
    expect(mentionedNames("show @reddit.mp4 over the intro", names)).toEqual([
      "reddit.mp4",
    ]);
  });

  it("finds a name with a space in it", () => {
    expect(mentionedNames("use @my clip.mov here", names)).toEqual([
      "my clip.mov",
    ]);
  });

  it("ignores a name that was never mentioned with an @", () => {
    expect(mentionedNames("reddit.mp4 is my file", names)).toEqual([]);
  });

  it("returns them in the library's order, not the sentence's", () => {
    expect(mentionedNames("@blog.mp4 then @reddit.mp4", names)).toEqual([
      "reddit.mp4",
      "blog.mp4",
    ]);
  });

  it("prefers the longest name, so a prefix does not steal the match", () => {
    const both = ["intro.mp4", "intro.mp4.bak"];
    expect(mentionedNames("@intro.mp4.bak", both)).toEqual(["intro.mp4.bak"]);
  });

  it("finds each file once, however often it is named", () => {
    expect(mentionedNames("@blog.mp4 and again @blog.mp4", names)).toEqual([
      "blog.mp4",
    ]);
  });
});
