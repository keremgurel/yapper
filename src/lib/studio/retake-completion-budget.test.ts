import { describe, expect, it } from "vitest";
import { MAX_CLEAN_TRANSCRIPT_WORDS } from "./clean-transcript-input";
import {
  retakeCompletionBudget,
  roomierCompletionBudget,
} from "./retake-completion-budget";

describe("retakeCompletionBudget", () => {
  it("starts the 1,399 word take where it stopped being cut off", () => {
    expect(retakeCompletionBudget(1_399)).toBe(12_000);
  });

  it("does not go below that for a short take", () => {
    expect(retakeCompletionBudget(1)).toBe(12_000);
    expect(retakeCompletionBudget(300)).toBe(12_000);
  });

  it("gives the 24 minute take the room it was measured to need", () => {
    expect(retakeCompletionBudget(2_892)).toBe(16_000);
  });

  it("never shrinks as the take gets longer", () => {
    let previous = 0;
    for (let words = 1; words <= MAX_CLEAN_TRANSCRIPT_WORDS; words += 137) {
      const budget = retakeCompletionBudget(words);
      expect(budget).toBeGreaterThanOrEqual(previous);
      previous = budget;
    }
  });

  it("leaves room to ask again on the longest take the route accepts", () => {
    const longest = retakeCompletionBudget(MAX_CLEAN_TRANSCRIPT_WORDS);
    expect(longest).toBe(28_000);
    expect(roomierCompletionBudget(longest)).toBe(32_000);
  });
});

describe("roomierCompletionBudget", () => {
  it("gives half as much again", () => {
    expect(roomierCompletionBudget(12_000)).toBe(18_000);
    expect(roomierCompletionBudget(16_000)).toBe(24_000);
  });

  it("stops at the ceiling", () => {
    expect(roomierCompletionBudget(24_000)).toBe(32_000);
    expect(roomierCompletionBudget(32_000)).toBeNull();
  });
});
