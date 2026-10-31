import { describe, expect, it } from "vitest";
import {
  isLocalDay,
  isLocalTime,
  isTimeZone,
  localDay,
  localTime,
  upcomingDays,
  zonedInstant,
} from "./zoned-time";

describe("zoned time", () => {
  it("accepts real zones, days and times only", () => {
    expect(isTimeZone("America/Toronto")).toBe(true);
    expect(isTimeZone("Mars/Olympus")).toBe(false);
    expect(isLocalDay("2026-10-31")).toBe(true);
    expect(isLocalDay("2026-02-30")).toBe(false);
    expect(isLocalDay("31/10/2026")).toBe(false);
    expect(isLocalTime("09:00")).toBe(true);
    expect(isLocalTime("24:00")).toBe(false);
  });

  it("turns a local day and time into the matching instant", () => {
    expect(
      zonedInstant("2026-10-30", "09:00", "America/Toronto").toISOString(),
    ).toBe("2026-10-30T13:00:00.000Z");
    expect(
      zonedInstant("2026-11-02", "09:00", "America/Toronto").toISOString(),
    ).toBe("2026-11-02T14:00:00.000Z");
    expect(
      zonedInstant("2026-10-30", "09:00", "Europe/Istanbul").toISOString(),
    ).toBe("2026-10-30T06:00:00.000Z");
  });

  it("reads an instant back as the creator's day and time", () => {
    const at = new Date("2026-10-31T02:30:00.000Z");
    expect(localDay(at, "America/Los_Angeles")).toBe("2026-10-30");
    expect(localTime(at, "America/Los_Angeles")).toBe("19:30");
    expect(localDay(at, "Asia/Tokyo")).toBe("2026-10-31");
  });

  it("lists the coming week by weekday across a clock change", () => {
    const days = upcomingDays(
      new Date("2026-10-30T16:00:00.000Z"),
      "America/Toronto",
    );
    expect(days[0]).toEqual({ date: "2026-10-30", weekday: "Friday" });
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]);
  });
});
