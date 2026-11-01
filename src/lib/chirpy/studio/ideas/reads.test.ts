import { describe, expect, it } from "vitest";
import { glance, RECENT_IDEAS, selectIdeas } from "./reads";
import { dayLabel, scheduledInstant } from "./when";

type Row = Parameters<typeof glance>[0];

function row(index: number, fields: Partial<Row> = {}): Row {
  return {
    id: `0000000${index}`.slice(-8) + "-0000-4000-8000-000000000000",
    title: `Idea ${index}`,
    status: "captured",
    stage: "library",
    ideaType: "original",
    scheduledFor: null,
    submissionId: null,
    formats: [],
    leadFormat: "short",
    versionFormats: [],
    pillar: null,
    pillarId: null,
    sourceUrl: null,
    editorRevision: null,
    sourceTitle: null,
    sourcePlatform: null,
    transcriptStatus: null,
    noSpeech: false,
    hasScript: false,
    script: null,
    originalNote: "",
    updatedAt: new Date(),
    createdAt: new Date(),
    ...fields,
  } as Row;
}

describe("selectIdeas", () => {
  const rows = Array.from({ length: 60 }, (_, index) => row(index));
  rows[50] = row(50, { title: "Why people quit the gym in February" });
  rows[55] = row(55, { title: "Morning routine", originalNote: "" });

  it("sends the newest ideas and older ones the request names", () => {
    const chosen = selectIdeas(rows, "delete the gym february one");
    expect(chosen.length).toBe(RECENT_IDEAS + 1);
    expect(chosen.map((item) => item.title)).toContain(
      "Why people quit the gym in February",
    );
    expect(chosen.map((item) => item.title)).not.toContain("Morning routine");
  });

  it("always includes the idea open on screen", () => {
    const chosen = selectIdeas(rows, "rename this", rows[55].id);
    expect(chosen[0].id).toBe(rows[55].id);
  });
});

describe("glance", () => {
  it("shows the calendar day in the creator's zone and an untitled note", () => {
    const seen = glance(
      row(1, {
        title: "",
        originalNote: "  gym   myths about cardio ",
        scheduledFor: new Date("2026-10-31T02:30:00.000Z"),
        versionFormats: ["article"],
        pillar: "Fitness",
      }),
      "America/Los_Angeles",
    );
    expect(seen).toMatchObject({
      title: "(untitled) gym myths about cardio",
      date: "2026-10-30",
      time: "19:30",
      formats: ["short", "article"],
      pillar: "Fitness",
      drafted: false,
    });
  });
});

describe("scheduling", () => {
  it("drops a new idea at 09:00 local and keeps an existing time", () => {
    expect(
      scheduledInstant(
        "2026-11-06",
        undefined,
        null,
        "America/Toronto",
      ).toISOString(),
    ).toBe("2026-11-06T14:00:00.000Z");
    expect(
      scheduledInstant(
        "2026-11-06",
        undefined,
        new Date("2026-10-30T22:30:00.000Z"),
        "America/Toronto",
      ).toISOString(),
    ).toBe("2026-11-06T23:30:00.000Z");
    expect(() =>
      scheduledInstant("2026-11-31", undefined, null, "America/Toronto"),
    ).toThrow("bad_date");
  });

  it("names the day the way the creator's clock reads it", () => {
    const at = new Date("2026-10-30T22:30:00.000Z");
    expect(dayLabel(at, "America/Toronto")).toBe("Fri, Oct 30");
    expect(dayLabel(at, "America/Toronto", true)).toBe(
      "Fri, Oct 30 at 6:30 PM",
    );
  });
});
