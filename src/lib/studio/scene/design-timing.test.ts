import { expect, it } from "vitest";
import { parseDesignInput } from "./design-input";
import { buildDesignUserMessage } from "./prompts/design-prompt";
import { paletteFor } from "./scene-colors";
const base = {
  frameAspect: 9 / 16,
  frameHeightPx: 1080,
  moments: [
    {
      id: "one",
      brief: "Show the change",
      kind: "other",
      quote: "before and now",
      duration: 4,
      box: { widthPx: 400, heightPx: 240, aspect: 400 / 240 },
    },
  ],
};
const input = (wordTimings: unknown) => ({
  ...base,
  moments: [{ ...base.moments[0], wordTimings }],
});
it("accepts old clients without word timing", () => {
  expect(parseDesignInput(base)?.moments[0].wordTimings).toBeUndefined();
});
it("supplies real speech cues to the designer", () => {
  const timing = [
    { text: "before", at: 0, end: 1 },
    { text: "now", at: 2.25, end: 2.6 },
  ];
  const parsed = parseDesignInput(input(timing))!;
  expect(parsed.moments[0].wordTimings).toEqual(timing);
  const message = buildDesignUserMessage(parsed.moments[0], {
    ...parsed,
    brand: { palette: paletteFor([]), hasKit: false, colors: [], logos: [] },
  });
  expect(message).toContain("2.250–2.600 now");
  expect(message).toContain(
    "Do not reveal the result before the speaker introduces it",
  );
});
// Every row is one `wordTimings` value. Wrapped once more because `it.each`
// spreads a row into arguments: a bare array of two timings would arrive as
// two parameters, and the assertion would only ever see the first.
const malformed: unknown[] = [
  [{ text: "now", at: -1, end: 1 }],
  [{ text: "now", at: 3, end: 4.1 }],
  [{ text: "now", at: 2, end: 1 }],
  [
    { text: "before", at: 2, end: 3 },
    { text: "now", at: 1, end: 2 },
  ],
  [{ text: "now", at: NaN, end: 3 }],
  [{ text: "now", at: "2", end: 3 }],
  Array.from({ length: 101 }, () => ({ text: "a", at: 0, end: 1 })),
];
it.each(malformed.map((timing) => [timing] as [unknown]))(
  "rejects malformed or unbounded word timing %j",
  (timing) => {
    expect(parseDesignInput(input(timing))).toBeNull();
  },
);
