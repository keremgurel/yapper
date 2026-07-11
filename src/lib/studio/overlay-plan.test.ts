import { describe, expect, it } from "vitest";
import {
  findQuoteSpan,
  keptWords,
  parsePlacements,
  placementsToSpans,
} from "@/lib/studio/overlay-plan";
import type { Clip, Word } from "@/lib/studio/types";

/** One word per second, so a span's seconds read straight off its indices. */
const transcribe = (text: string): Word[] =>
  text
    .split(" ")
    .map((t, i) => ({ id: `w-${i}`, text: t, start: i, end: i + 1 }));

const words = transcribe(
  "so I built a reddit automation that posts every morning and then I wrote the newsletter by hand",
);

describe("findQuoteSpan", () => {
  it("finds a phrase copied verbatim", () => {
    expect(findQuoteSpan(words, "reddit automation that posts")).toEqual({
      start: 4,
      end: 7,
    });
  });

  it("ignores case and punctuation on both sides", () => {
    const punctuated = transcribe("I built a Reddit automation, honestly.");
    expect(findQuoteSpan(punctuated, "reddit automation honestly")).toEqual({
      start: 3,
      end: 5,
    });
  });

  it("forgives a word the model got wrong", () => {
    // "posts each morning" against "posts every morning": 2 of 3 tokens agree.
    expect(findQuoteSpan(words, "posts each morning")).toEqual({
      start: 7,
      end: 9,
    });
  });

  it("refuses a quote that is mostly not there", () => {
    expect(findQuoteSpan(words, "kubernetes cluster autoscaling")).toBeNull();
  });

  it("refuses a quote longer than the transcript", () => {
    expect(
      findQuoteSpan(transcribe("hello there"), "hello there friend"),
    ).toBeNull();
  });

  it("refuses an empty quote", () => {
    expect(findQuoteSpan(words, "   ")).toBeNull();
  });

  it("takes the first occurrence of a repeated phrase", () => {
    const repeated = transcribe(
      "the newsletter and later the newsletter again",
    );
    expect(findQuoteSpan(repeated, "the newsletter")).toEqual({
      start: 0,
      end: 1,
    });
  });
});

describe("placementsToSpans", () => {
  const files = ["reddit.mp4", "blog.mp4"];

  it("turns a quote into the seconds its words occupy", () => {
    const [span] = placementsToSpans(
      words,
      [
        {
          file: "reddit.mp4",
          quote: "reddit automation that posts",
          reason: "b-roll",
        },
      ],
      files,
    );
    expect(span).toEqual({
      file: "reddit.mp4",
      reason: "b-roll",
      sourceStart: 4,
      sourceEnd: 8,
    });
  });

  it("drops a file the library has never heard of", () => {
    expect(
      placementsToSpans(
        words,
        [{ file: "invented.mp4", quote: "reddit automation" }],
        files,
      ),
    ).toEqual([]);
  });

  it("drops a quote the speaker never said", () => {
    expect(
      placementsToSpans(
        words,
        [{ file: "reddit.mp4", quote: "quarterly earnings call" }],
        files,
      ),
    ).toEqual([]);
  });

  it("drops a span too short to be a shot", () => {
    const fast = [{ id: "w-0", text: "reddit", start: 1, end: 1.1 }];
    expect(
      placementsToSpans(fast, [{ file: "reddit.mp4", quote: "reddit" }], files),
    ).toEqual([]);
  });

  it("keeps every placement it can back with the transcript", () => {
    const spans = placementsToSpans(
      words,
      [
        { file: "reddit.mp4", quote: "reddit automation" },
        { file: "nope.mp4", quote: "reddit automation" },
        { file: "blog.mp4", quote: "wrote the newsletter" },
      ],
      files,
    );
    expect(spans.map((s) => s.file)).toEqual(["reddit.mp4", "blog.mp4"]);
  });
});

describe("parsePlacements", () => {
  it("reads the shape the model was asked for", () => {
    const reply =
      '{"placements":[{"file":"a.mp4","quote":"the newsletter","reason":"why"}]}';
    expect(parsePlacements(reply)).toEqual([
      { file: "a.mp4", quote: "the newsletter", reason: "why" },
    ]);
  });

  it("digs the object out of a chatty or fenced reply", () => {
    const reply =
      'Sure! ```json\n{"placements":[{"file":"a.mp4","quote":"hello"}]}\n``` hope that helps';
    expect(parsePlacements(reply)).toEqual([
      { file: "a.mp4", quote: "hello", reason: undefined },
    ]);
  });

  it("keeps the good entries and drops the malformed ones", () => {
    const reply =
      '{"placements":[{"file":"a.mp4"},{"quote":"x"},null,7,{"file":"b.mp4","quote":"y"}]}';
    expect(parsePlacements(reply)).toEqual([
      { file: "b.mp4", quote: "y", reason: undefined },
    ]);
  });

  it("returns nothing for a reply that is not JSON at all", () => {
    expect(parsePlacements("I could not find anything.")).toEqual([]);
    expect(parsePlacements('{"placements": "soon"}')).toEqual([]);
    expect(parsePlacements("{ not json ]")).toEqual([]);
  });
});

describe("keptWords", () => {
  const spoken = transcribe("one two three four five");

  it("keeps the words a viewer would still hear", () => {
    // The clip keeps 1..3, so words two and three survive.
    const clips: Clip[] = [{ id: "a", start: 1, end: 3 }];
    expect(keptWords(spoken, clips).map((w) => w.text)).toEqual([
      "two",
      "three",
    ]);
  });

  it("keeps words from every clip, in transcript order", () => {
    const clips: Clip[] = [
      { id: "a", start: 0, end: 1 },
      { id: "b", start: 3, end: 5 },
    ];
    expect(keptWords(spoken, clips).map((w) => w.text)).toEqual([
      "one",
      "four",
      "five",
    ]);
  });

  it("does not count an appended clip's own seconds as the recording's", () => {
    const appended: Clip = {
      id: "b",
      start: 0,
      end: 5,
      src: { url: "b.mp4", kind: "video", name: "b.mp4", duration: 9 },
    };
    expect(keptWords(spoken, [appended])).toEqual([]);
  });

  it("keeps nothing when the bottom track is empty", () => {
    expect(keptWords(spoken, [])).toEqual([]);
  });
});
