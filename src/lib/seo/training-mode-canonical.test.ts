import { describe, expect, it } from "vitest";
import { trainingModes } from "@/data/training-modes";
import { trainingModeCanonical } from "./training-mode-canonical";

describe("canonical page for a practice mode", () => {
  it("points a mode at its own exercise page", () => {
    expect(trainingModeCanonical("interview-prep")).toBe(
      "/training/interview-prep",
    );
    expect(trainingModeCanonical("freestyle-speech")).toBe("/freestyle-speech");
  });
  it("returns null for a mode with no page, and for junk", () => {
    expect(trainingModeCanonical("research-and-explain")).toBeNull();
    expect(trainingModeCanonical("../pricing")).toBeNull();
  });
  it("resolves every mode but the one that has no page", () => {
    expect(
      trainingModes
        .filter((mode) => !trainingModeCanonical(mode.slug))
        .map((mode) => mode.slug),
    ).toEqual(["research-and-explain"]);
  });
});
