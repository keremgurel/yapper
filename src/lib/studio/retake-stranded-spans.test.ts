import { describe, expect, it } from "vitest";
import { cutStrandedSpans, strandedKeptSpans } from "./retake-stranded-spans";

type Span = [number, number];
const LINE = "And today we are baking two loaves of sourdough for the market.";
const RETAKE =
  "And today we are baking two loaves of sourdough for the market stall.";

/**
 * A transcript written with the cut in it: words inside [brackets] are the
 * ones the model dropped. Returns the words, the cuts, and a way to find a
 * phrase by its text.
 */
function edit(marked: string) {
  const words: { text: string }[] = [];
  const cuts: Span[] = [];
  let open = -1;
  for (const raw of marked.split(/\s+/).filter(Boolean)) {
    if (raw.startsWith("[")) open = words.length;
    words.push({ text: raw.replace(/[[\]]/g, "") });
    if (raw.endsWith("]")) cuts.push([open, words.length - 1]);
  }
  const span = (phrase: string): Span => {
    const target = phrase.split(" ");
    const start = words.findIndex((_, i) =>
      target.every((word, j) => words[i + j]?.text === word),
    );
    if (start < 0) throw new Error(`"${phrase}" is not in the transcript`);
    return [start, start + target.length - 1];
  };
  return { words, cuts, span };
}

describe("strandedKeptSpans", () => {
  it("finds a sentence kept between a dropped line and its retake", () => {
    const take = edit(
      `Welcome back. [${LINE}] And that is plenty. [And today we are] ${RETAKE} Start with the flour.`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([
      take.span("And that is plenty."),
    ]);
  });

  it("leaves a sentence that runs straight into the retake", () => {
    // Far more often the new opening of a passage recorded again.
    const take = edit(
      `Welcome back. [${LINE}] And that is plenty. ${RETAKE} Start with the flour.`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("leaves the first sentence of a passage recorded again from the top", () => {
    const take = edit(
      `[Here is the plan. ${LINE}] Here is the plan. [And today we are] ${RETAKE}`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("leaves a single word", () => {
    const take = edit(`[${LINE}] Okay. [And today we are] ${RETAKE}`);
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("ignores punctuation and case when matching the two deliveries", () => {
    const take = edit(
      `[and today, we are baking two loaves of Sourdough for the market.] And that is plenty. [And today] ${RETAKE}`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([
      take.span("And that is plenty."),
    ]);
  });

  it("leaves the sentence when the first delivery of the line is the one kept", () => {
    const take = edit(
      `Welcome back. ${LINE} And that is plenty. [And today we are ${RETAKE}] Start with the flour.`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("leaves a kept stretch that is longer than a sentence", () => {
    const take = edit(
      `[${LINE}] The oven goes on first because it takes a full hour to come up to heat. [And today we are] ${RETAKE}`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("leaves a new lead-in to the retake, which does not end a sentence", () => {
    const take = edit(
      `Welcome back. [${LINE}] Honestly though, [And today] ${RETAKE}`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("leaves a sentence between two lines that only open the same way", () => {
    const take = edit(
      "[And today we are baking bread for the Saturday market.] It sells out. [And today] And today we are also testing a new oven from Italy.",
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("leaves a sentence when the words dropped before it are something else", () => {
    const take = edit(
      `[Sorry, let me check my notes for a second.] And that is plenty. [And today we are] ${RETAKE}`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("leaves a sentence when the dropped line is too far back to be what it followed", () => {
    const filler = Array.from({ length: 45 }, () => "um").join(" ");
    const take = edit(
      `[${LINE} ${filler}] And that is plenty. [And today we are] ${RETAKE}`,
    );
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });

  it("finds nothing when nothing is cut", () => {
    const take = edit(`${LINE} And that is plenty. ${RETAKE}`);
    expect(strandedKeptSpans(take.words, take.cuts)).toEqual([]);
  });
});

describe("cutStrandedSpans", () => {
  it("joins the stranded sentence to the cuts on either side of it", () => {
    const take = edit(
      `Welcome back. [${LINE}] And that is plenty. [And today we are] ${RETAKE}`,
    );
    const [lineStart] = take.span("And today we are");
    const [, falseStartEnd] = take.cuts[1]!;
    expect(cutStrandedSpans(take.words, take.cuts)).toEqual([
      [lineStart, falseStartEnd],
    ]);
  });

  it("returns the model's cuts untouched when nothing is stranded", () => {
    const take = edit(`Welcome back. [And today we are] ${RETAKE}`);
    expect(cutStrandedSpans(take.words, take.cuts)).toBe(take.cuts);
  });
});
