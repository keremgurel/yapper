import { describe, expect, it } from "vitest";
import { parseOverlayInput } from "@/lib/studio/overlay-input";

const valid = {
  instruction: "Place the graph here",
  words: [{ text: "A" }, { text: "graph" }],
  files: [{ name: "graph.png", kind: "image", duration: 2, aspect: 1.5 }],
  effects: [{ id: "pop", name: "Pop", detail: "Short pop" }],
  placed: [{ name: "old.png", at: 1 }],
  speaker: [{ at: 1, x: 0.1, y: 0.1, width: 0.4, height: 0.5 }],
  frameAspect: 9 / 16,
} as const;

describe("parseOverlayInput", () => {
  it("accepts a valid bounded prompt input", () => {
    expect(parseOverlayInput(valid)).toMatchObject(valid);
  });

  it("rejects over-cap arrays and strings", () => {
    expect(
      parseOverlayInput({ ...valid, files: Array(51).fill(valid.files[0]) }),
    ).toBeNull();
    expect(
      parseOverlayInput({ ...valid, instruction: "x".repeat(1_001) }),
    ).toBeNull();
    expect(
      parseOverlayInput({ ...valid, words: [{ text: "x".repeat(81) }] }),
    ).toBeNull();
    expect(
      parseOverlayInput({ ...valid, words: [{ text: "   " }] }),
    ).toBeNull();
  });

  it("preserves an empty transcript for the route's no_transcript response", () => {
    expect(parseOverlayInput({ ...valid, words: [] })).toMatchObject({
      words: [],
    });
  });

  it("rejects malformed and non-finite numeric values before toFixed", () => {
    expect(
      parseOverlayInput({
        ...valid,
        files: [{ ...valid.files[0], duration: NaN }],
      }),
    ).toBeNull();
    expect(
      parseOverlayInput({
        ...valid,
        speaker: [{ ...valid.speaker[0], x: Infinity }],
      }),
    ).toBeNull();
    expect(parseOverlayInput({ ...valid, frameAspect: "wide" })).toBeNull();
  });
});
