import { describe, expect, it } from "vitest";
import { quickTimes } from "./quick-times";

describe("quick schedule times", () => {
  it("offers tomorrow morning, tomorrow evening and Saturday morning", () => {
    // A Wednesday afternoon in local time.
    const options = quickTimes(new Date(2026, 9, 28, 15, 30));
    expect(options.map((option) => option.at)).toEqual([
      new Date(2026, 9, 29, 9),
      new Date(2026, 9, 29, 18),
      new Date(2026, 9, 31, 10),
    ]);
  });

  it("does not offer Saturday twice when tomorrow is Saturday", () => {
    const options = quickTimes(new Date(2026, 9, 30, 20));
    expect(options).toHaveLength(2);
    expect(options[0].at).toEqual(new Date(2026, 9, 31, 9));
  });

  it("offers next week's Saturday on a Saturday", () => {
    const options = quickTimes(new Date(2026, 9, 31, 8));
    expect(options[2].at).toEqual(new Date(2026, 10, 7, 10));
  });
});
