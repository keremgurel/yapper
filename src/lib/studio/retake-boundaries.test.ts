import { expect, it } from "vitest";
import { clippedRetakeOpenings } from "./retake-boundaries";
const words = (text: string) =>
  text
    .split(" ")
    .map((text, i) => ({ text, start: i * 0.2, end: (i + 1) * 0.2 }));
it("flags a retained maintenance take with its attached Now clipped", () => {
  const transcript = words(
    "Now it's just maintenance work and adding new Now it's just maintenance work and adding new questions",
  );
  expect(clippedRetakeOpenings(transcript, [[0, 8]])).toEqual([8]);
  expect(clippedRetakeOpenings(transcript, [[0, 7]])).toEqual([]);
});
it("does not restore an adjacent stutter or a detached abandoned prefix", () => {
  const stutter = words("I I wanted to see if I I wanted to see if");
  expect(clippedRetakeOpenings(stutter, [[0, 6]])).toEqual([]);
  const detached = words(
    "Now it's just maintenance work and adding new Now it's just maintenance work",
  );
  detached[9]!.start += 1;
  expect(clippedRetakeOpenings(detached, [[0, 8]])).toEqual([]);
});
it("does not infer missing prefixes from shared topics or short generic phrases", () => {
  expect(
    clippedRetakeOpenings(
      words("some of it was useful some of it was a waste"),
      [[0, 5]],
    ),
  ).toEqual([]);
});
