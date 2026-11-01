import { describe, expect, it } from "vitest";
import { StudioActionFailure } from "../executor";
import { localLabel, postingInstant } from "./when";

const NOW = Date.parse("2026-10-28T14:15:00Z");
const ZONE = "America/Toronto";

describe("postingInstant", () => {
  it("keeps a post's own time when none is given", () => {
    const at = postingInstant(
      "2026-11-02",
      undefined,
      new Date("2026-10-29T13:00:00Z"),
      ZONE,
      NOW,
    );
    expect(at.toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });

  it("refuses a time the publish clock could not send", () => {
    expect(() =>
      postingInstant("2026-10-28", "09:00", null, ZONE, NOW),
    ).toThrow(StudioActionFailure);
    expect(() =>
      postingInstant("2027-03-01", "09:00", null, ZONE, NOW),
    ).toThrow("too_far");
  });
});

describe("localLabel", () => {
  it("names the day the planner wrote, with the time when there is one", () => {
    expect(localLabel("2026-11-06")).toBe("Fri, Nov 6");
    expect(localLabel("2026-11-06", "18:30")).toBe("Fri, Nov 6 at 6:30 PM");
  });
});
