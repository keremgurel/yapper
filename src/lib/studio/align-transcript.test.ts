import { describe, expect, it } from "vitest";
import { cutsFromCleanedText } from "@/lib/studio/align-transcript";

const words = (text: string) => text.split(" ").map((t) => ({ text: t }));

describe("cutsFromCleanedText", () => {
  it("cuts nothing when the cleaned text already matches the words", () => {
    expect(cutsFromCleanedText(words("hello world"), "hello world")).toEqual(
      [],
    );
  });

  it("keeps the LAST occurrence of a restated phrase, cutting the earlier one", () => {
    // "the cat" is said twice; the final take (indices 2-4) survives, the first
    // attempt (0-1) is cut. Aligning from the right is what lands on the keeper.
    expect(
      cutsFromCleanedText(words("the cat the cat sat"), "the cat sat"),
    ).toEqual([[0, 1]]);
  });

  it("cuts a leading stutter", () => {
    expect(cutsFromCleanedText(words("I I am here"), "I am here")).toEqual([
      [0, 0],
    ]);
  });

  it("matches case- and punctuation-insensitively", () => {
    // norm() lowercases and strips punctuation, so these align fully: no cuts.
    expect(cutsFromCleanedText(words("Hello, World!"), "hello world")).toEqual(
      [],
    );
  });

  it("never cuts a punctuation-only token, even between two cuts", () => {
    // The comma normalizes to empty; it is always kept, so it splits the removed
    // "um" and "uh" into two ranges rather than being swallowed into one.
    expect(cutsFromCleanedText(words("um , uh hello"), "hello")).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  it("cuts every earlier word when only the tail survives", () => {
    expect(cutsFromCleanedText(words("a b c hello"), "hello")).toEqual([
      [0, 2],
    ]);
  });

  // Regression for the "1-Click edit keeps almost all the retakes" bug: a
  // real DJI recording had the speaker restart the same sentence 4-6 times.
  // The old right-to-left nearest-neighbor walk would latch onto a stray
  // shared word (here, "the") from the sentence right before the retake
  // cluster, then zig-zag across the near-identical takes instead of cutting
  // them whole — leaving most of each earlier take un-struck. This fixture
  // reproduces that shape: a lead-in sentence, five near-identical retakes of
  // one sentence (only the last is clean), and a following sentence.
  it("cuts a whole cluster of near-identical retakes, keeping only the last", () => {
    // The lead-in deliberately ends in "course" — a word that also recurs
    // inside the retakes. That shared word is what let the old right-to-left
    // walk latch onto a position deep inside an earlier attempt instead of
    // skipping cleanly past the whole cluster.
    const lead = "Let's talk about how you can prepare for the course.";
    const attempts = [
      "You can take full practice tests and drill some questions or you know go through the modules.",
      "You can take full practice tests, drill individual, uh, questions, or go through modules.",
      "You can take full practice tests, drill individual questions, or, um, go through the course.",
      "You can take full practice tests drill individual questions or go through the the course modules.",
      "You can take full practice tests, drill individual questions, or go through the course modules directly at the site.",
    ];
    const follow = "Now let's talk about pricing options for the course.";

    const sourceText = [lead, ...attempts, follow].join(" ");
    const cleanedText = [lead, attempts[attempts.length - 1], follow].join(" ");

    const cuts = cutsFromCleanedText(words(sourceText), cleanedText);

    const allWords = words(sourceText);
    const cutIndexes = new Set<number>();
    for (const [from, to] of cuts) {
      for (let i = from; i <= to; i++) cutIndexes.add(i);
    }
    const kept = allWords
      .filter((_, i) => !cutIndexes.has(i))
      .map((w) => w.text.toLowerCase().replace(/[^a-z0-9' ]/g, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const expectedKept = cleanedText
      .toLowerCase()
      .replace(/[^a-z0-9' ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    expect(kept).toBe(expectedKept);
    // None of the first four (flawed) attempts may survive intact anywhere.
    for (const attempt of attempts.slice(0, -1)) {
      const normalizedAttempt = attempt
        .toLowerCase()
        .replace(/[^a-z0-9' ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      expect(kept).not.toContain(normalizedAttempt);
    }
  });
});
