import { describe, expect, it } from "vitest";
import {
  TRAIN_FAIR_USE_DAILY_SESSIONS,
  fairUseDayStart,
  fairUseResetsAt,
  withinFairUse,
} from "./train-fair-use";

describe("Train Plus fair use", () => {
  it("allows sessions up to the daily ceiling and refuses the next one", () => {
    expect(withinFairUse(0)).toBe(true);
    expect(withinFairUse(TRAIN_FAIR_USE_DAILY_SESSIONS - 1)).toBe(true);
    expect(withinFairUse(TRAIN_FAIR_USE_DAILY_SESSIONS)).toBe(false);
  });
  it("counts by UTC day and resets at the next UTC midnight", () => {
    const now = new Date("2026-10-02T23:59:30Z");
    expect(fairUseDayStart(now).toISOString()).toBe("2026-10-02T00:00:00.000Z");
    expect(fairUseResetsAt(now).toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });
});
