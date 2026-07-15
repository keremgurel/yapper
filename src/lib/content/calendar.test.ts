import { describe, expect, it } from "vitest";
import {
  bucketByDay,
  dayKey,
  isSameMonth,
  monthWeeks,
  rescheduleIso,
  sameDay,
  startOfWeek,
  weekDays,
} from "./calendar";

describe("dayKey", () => {
  it("formats local Y-M-D zero-padded", () => {
    expect(dayKey(new Date(2025, 0, 5))).toBe("2025-01-05");
    expect(dayKey(new Date(2025, 9, 31))).toBe("2025-10-31");
  });
});

describe("startOfWeek / weekDays", () => {
  it("weeks start on Sunday", () => {
    // Oct 1 2025 is a Wednesday; its week starts Sun Sep 28.
    expect(dayKey(startOfWeek(new Date(2025, 9, 1)))).toBe("2025-09-28");
  });
  it("returns 7 consecutive days, Sunday first", () => {
    const days = weekDays(new Date(2025, 9, 8));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days[6].getDay()).toBe(6);
    expect(dayKey(days[0])).toBe("2025-10-05");
    expect(dayKey(days[6])).toBe("2025-10-11");
  });
});

describe("monthWeeks", () => {
  it("covers Oct 2025 as 5 weeks from Sep 28 to Nov 1", () => {
    const weeks = monthWeeks(new Date(2025, 9, 15));
    expect(weeks).toHaveLength(5);
    expect(dayKey(weeks[0][0])).toBe("2025-09-28");
    expect(dayKey(weeks[4][6])).toBe("2025-11-01");
    // Every row is a full week.
    for (const w of weeks) expect(w).toHaveLength(7);
  });
  it("includes the last day of the month", () => {
    const weeks = monthWeeks(new Date(2025, 9, 1));
    const keys = weeks.flat().map(dayKey);
    expect(keys).toContain("2025-10-31");
  });
});

describe("isSameMonth / sameDay", () => {
  it("distinguishes trailing days of an adjacent month", () => {
    expect(isSameMonth(new Date(2025, 8, 28), new Date(2025, 9, 15))).toBe(
      false,
    );
    expect(isSameMonth(new Date(2025, 9, 5), new Date(2025, 9, 15))).toBe(true);
  });
  it("sameDay ignores time of day", () => {
    expect(sameDay(new Date(2025, 9, 5, 9), new Date(2025, 9, 5, 23))).toBe(
      true,
    );
    expect(sameDay(new Date(2025, 9, 5), new Date(2025, 9, 6))).toBe(false);
  });
});

describe("bucketByDay", () => {
  it("groups by local day and sorts each day by time", () => {
    const items = [
      { id: "late", at: new Date(2025, 9, 5, 17, 0).toISOString() },
      { id: "early", at: new Date(2025, 9, 5, 8, 0).toISOString() },
      { id: "other", at: new Date(2025, 9, 6, 12, 0).toISOString() },
      { id: "none", at: null },
    ];
    const map = bucketByDay(items, (i) => i.at);
    expect(map.get("2025-10-05")?.map((i) => i.id)).toEqual(["early", "late"]);
    expect(map.get("2025-10-06")?.map((i) => i.id)).toEqual(["other"]);
    // Undated items are dropped entirely.
    expect([...map.values()].flat().some((i) => i.id === "none")).toBe(false);
  });
});

describe("rescheduleIso", () => {
  it("moves to the target day but keeps the original time of day", () => {
    const orig = new Date(2025, 9, 22, 14, 30).toISOString();
    const moved = new Date(rescheduleIso(orig, new Date(2025, 9, 21)));
    expect(moved.getFullYear()).toBe(2025);
    expect(moved.getMonth()).toBe(9);
    expect(moved.getDate()).toBe(21);
    expect(moved.getHours()).toBe(14);
    expect(moved.getMinutes()).toBe(30);
  });
  it("defaults to 9am when the item had no prior time", () => {
    const moved = new Date(rescheduleIso(null, new Date(2025, 9, 21)));
    expect(moved.getDate()).toBe(21);
    expect(moved.getHours()).toBe(9);
    expect(moved.getMinutes()).toBe(0);
  });
});
