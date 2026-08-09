import { describe, expect, it } from "vitest";
import {
  findQuoteSpan,
  keptWords,
  parsePlacements,
  parseSounds,
  parseTexts,
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

  it("carries the box the model asked for", () => {
    const reply =
      '{"placements":[{"file":"a.mp4","quote":"hello","x":0.06,"y":0.05,"width":0.55}]}';
    expect(parsePlacements(reply)[0].box).toEqual({
      x: 0.06,
      y: 0.05,
      width: 0.55,
    });
  });

  // The words are the hard part. A model that fumbles the arithmetic should
  // still land its cutaway on the right sentence, in the client's default card.
  it("drops a bad box without dropping the placement", () => {
    const box = (fields: string) =>
      parsePlacements(
        `{"placements":[{"file":"a.mp4","quote":"hello"${fields}}]}`,
      )[0];
    // Nothing said at all.
    expect(box("").box).toBeUndefined();
    // Half a box is not a box.
    expect(box(',"width":0.5').box).toBeUndefined();
    // Pixels, not fractions.
    expect(box(',"x":120,"y":40,"width":600').box).toBeUndefined();
    // A width of zero would be an overlay nobody can see.
    expect(box(',"x":0.1,"y":0.1,"width":0').box).toBeUndefined();
    // Strings where numbers belong.
    expect(box(',"x":"left","y":"top","width":"half"').box).toBeUndefined();
    // Every one of those kept the placement itself.
    expect(box("").file).toBe("a.mp4");
  });

  it("carries the cue, the group and the sound", () => {
    const reply =
      '{"placements":[{"file":"ig.png","quote":"on Instagram and TikTok",' +
      '"cue":"Instagram","group":"icons","sound":"pop"}]}';
    const placement = parsePlacements(reply)[0];
    expect(placement.cue).toBe("Instagram");
    expect(placement.group).toBe("icons");
    expect(placement.sound).toBe("pop");
  });

  it("treats blank strings as absent", () => {
    const reply =
      '{"placements":[{"file":"a.mp4","quote":"hello","cue":"  ","group":""}]}';
    const placement = parsePlacements(reply)[0];
    expect(placement.cue).toBeUndefined();
    expect(placement.group).toBeUndefined();
  });
});

describe("parseSounds", () => {
  const known = ["pop", "whoosh", "cha-ching"];

  it("reads the shape the model was asked for", () => {
    const reply =
      '{"sounds":[{"effect":"pop","quote":"on Instagram","cue":"Instagram"},' +
      '{"effect":"whoosh","every":"cut"}]}';
    expect(parseSounds(reply, known)).toEqual([
      {
        effect: "pop",
        quote: "on Instagram",
        cue: "Instagram",
        every: undefined,
        at: undefined,
      },
      {
        effect: "whoosh",
        quote: undefined,
        cue: undefined,
        every: "cut",
        at: undefined,
      },
    ]);
  });

  // The client checks the user really typed that time before acting on it, but
  // a negative or nonsense one never needs to get that far.
  it("carries a usable time and drops an unusable one", () => {
    expect(
      parseSounds('{"sounds":[{"effect":"pop","at":12}]}', known)[0].at,
    ).toBe(12);
    expect(
      parseSounds('{"sounds":[{"effect":"pop","at":-3}]}', known)[0].at,
    ).toBeUndefined();
    expect(
      parseSounds('{"sounds":[{"effect":"pop","at":"0:12"}]}', known)[0].at,
    ).toBeUndefined();
  });

  // The library is fixed and travels with the question, so an effect the client
  // does not have is dropped here rather than sent back for it to puzzle over.
  it("drops an effect the client does not have", () => {
    const reply = '{"sounds":[{"effect":"airhorn"},{"effect":"pop"}]}';
    expect(parseSounds(reply, known).map((s) => s.effect)).toEqual(["pop"]);
  });

  it("asks for no sounds when the client sent no library", () => {
    expect(parseSounds('{"sounds":[{"effect":"pop"}]}', [])).toEqual([]);
  });

  it("returns nothing for a reply with no sounds in it", () => {
    expect(parseSounds('{"placements":[]}', known)).toEqual([]);
    expect(parseSounds('{"sounds":"later"}', known)).toEqual([]);
    expect(parseSounds("not json at all", known)).toEqual([]);
  });

  it("keeps the good entries and drops the malformed ones", () => {
    const reply =
      '{"sounds":[null,7,{"quote":"x"},{"effect":"  "},{"effect":"pop"}]}';
    expect(parseSounds(reply, known).map((s) => s.effect)).toEqual(["pop"]);
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

describe("parseTexts", () => {
  it("reads the shape the model was asked for", () => {
    const reply =
      '{"texts":[{"text":"44%","quote":"44% of users came from search",' +
      '"cue":"44%","until":"next"}]}';
    expect(parseTexts(reply)).toEqual([
      {
        text: "44%",
        quote: "44% of users came from search",
        cue: "44%",
        until: "next",
      },
    ]);
  });

  it("keeps every mention as its own entry", () => {
    const reply =
      '{"texts":[{"text":"44%","quote":"44% of users"},' +
      '{"text":"12%","quote":"and 12% from socials"}]}';
    expect(parseTexts(reply).map((t) => t.text)).toEqual(["44%", "12%"]);
  });

  it("drops an entry with nothing to say or nowhere to say it", () => {
    expect(parseTexts('{"texts":[{"quote":"44% of users"}]}')).toEqual([]);
    expect(parseTexts('{"texts":[{"text":"44%"}]}')).toEqual([]);
    expect(parseTexts('{"texts":[{"text":"  ","quote":"44%"}]}')).toEqual([]);
  });

  it("is unbothered by a reply that carries no text at all", () => {
    expect(parseTexts('{"placements":[]}')).toEqual([]);
    expect(parseTexts("not json")).toEqual([]);
  });

  it("holds an until quoted from later in the transcript", () => {
    const reply =
      '{"texts":[{"text":"44%","quote":"44% of users",' +
      '"until":"that is the whole funnel"}]}';
    expect(parseTexts(reply)[0].until).toBe("that is the whole funnel");
  });
});
