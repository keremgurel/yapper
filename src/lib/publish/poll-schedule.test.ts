import { describe, expect, it } from "vitest";
import { PUBLISH_POLL_ATTEMPTS, publishPollDelayMs } from "./poll-schedule";

const waits = Array.from({ length: PUBLISH_POLL_ATTEMPTS - 1 }, (_, attempt) =>
  publishPollDelayMs(attempt),
);

describe("publish status polling", () => {
  it("checks quickly at first, then backs off", () => {
    expect(waits.slice(0, 5)).toEqual([2_000, 2_000, 2_000, 2_000, 2_000]);
    expect(waits[5]).toBe(3_000);
    expect(waits[14]).toBe(3_000);
    expect(waits[15]).toBe(5_000);
  });

  it("keeps checking for at least two minutes", () => {
    expect(
      waits.reduce((total, wait) => total + wait, 0),
    ).toBeGreaterThanOrEqual(120_000);
  });

  it("stays under 30 status reads in any minute", () => {
    let elapsed = 0;
    let reads = 1;
    for (const wait of waits) {
      elapsed += wait;
      if (elapsed > 60_000) break;
      reads += 1;
    }
    expect(reads).toBeLessThan(30);
  });
});
