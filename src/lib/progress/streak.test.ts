import { describe, expect, it } from "vitest";
import { dayKey, dayStreak, isValidTimeZone } from "./streak";

/** Noon UTC on a date, comfortably inside the same day for UTC assertions. */
function utcNoon(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects junk", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("<script>")).toBe(false);
  });
});

describe("dayKey", () => {
  it("formats as YYYY-MM-DD in the requested zone", () => {
    const instant = new Date("2026-03-10T02:00:00Z");
    expect(dayKey(instant, "UTC")).toBe("2026-03-10");
    // 2am UTC is still the previous evening on the US west coast.
    expect(dayKey(instant, "America/Los_Angeles")).toBe("2026-03-09");
    // And already the same day's morning in Tokyo.
    expect(dayKey(instant, "Asia/Tokyo")).toBe("2026-03-10");
  });
});

describe("dayStreak", () => {
  const now = utcNoon("2026-08-17");

  it("is 0 with no sessions", () => {
    expect(dayStreak([], "UTC", now)).toBe(0);
  });

  it("counts a single session today as 1", () => {
    expect(dayStreak([utcNoon("2026-08-17")], "UTC", now)).toBe(1);
  });

  it("counts several sessions on the same day once", () => {
    const sessions = [
      new Date("2026-08-17T08:00:00Z"),
      new Date("2026-08-17T13:00:00Z"),
      new Date("2026-08-17T21:00:00Z"),
    ];
    expect(dayStreak(sessions, "UTC", now)).toBe(1);
  });

  it("keeps a streak alive when the last practice was yesterday", () => {
    const sessions = [utcNoon("2026-08-16"), utcNoon("2026-08-15")];
    expect(dayStreak(sessions, "UTC", now)).toBe(2);
  });

  it("is 0 when the last practice was two days ago", () => {
    const sessions = [utcNoon("2026-08-15"), utcNoon("2026-08-14")];
    expect(dayStreak(sessions, "UTC", now)).toBe(0);
  });

  it("stops at a gap", () => {
    const sessions = [
      utcNoon("2026-08-17"),
      utcNoon("2026-08-16"),
      // gap on the 15th
      utcNoon("2026-08-14"),
      utcNoon("2026-08-13"),
    ];
    expect(dayStreak(sessions, "UTC", now)).toBe(2);
  });

  it("crosses month boundaries", () => {
    const nowSept = utcNoon("2026-09-01");
    const sessions = [utcNoon("2026-09-01"), utcNoon("2026-08-31")];
    expect(dayStreak(sessions, "UTC", nowSept)).toBe(2);
  });

  it("depends on the viewer's timezone at day boundaries", () => {
    // 6am UTC on Aug 17: already the 17th in UTC, still the evening of the
    // 16th in Los Angeles.
    const lateSession = new Date("2026-08-17T06:00:00Z");
    const nowSameDay = new Date("2026-08-17T18:00:00Z");
    // UTC viewer practiced today; LA viewer practiced yesterday. Both hold 1.
    expect(dayStreak([lateSession], "UTC", nowSameDay)).toBe(1);
    expect(dayStreak([lateSession], "America/Los_Angeles", nowSameDay)).toBe(1);
    // On Aug 18 the UTC viewer's session was yesterday (streak holds at 1),
    // but the LA viewer's was two LA days ago, so theirs is gone.
    const nowNextDay = new Date("2026-08-18T12:00:00Z");
    expect(dayStreak([lateSession], "UTC", nowNextDay)).toBe(1);
    expect(dayStreak([lateSession], "America/Los_Angeles", nowNextDay)).toBe(0);
  });

  it("survives a DST transition without skipping a day", () => {
    // US spring forward: 2026-03-08 in America/Los_Angeles.
    const nowAfter = new Date("2026-03-09T20:00:00Z"); // Mar 9, noon in LA
    const sessions = [
      new Date("2026-03-09T17:00:00Z"), // Mar 9 in LA
      new Date("2026-03-08T17:00:00Z"), // Mar 8 in LA (DST day)
      new Date("2026-03-07T17:00:00Z"), // Mar 7 in LA
    ];
    expect(dayStreak(sessions, "America/Los_Angeles", nowAfter)).toBe(3);
  });
});
