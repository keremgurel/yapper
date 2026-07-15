import { describe, expect, it } from "vitest";
import { sortContent, type ContentSort } from "@/lib/content/sort";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

function row(fields: Partial<ContentSummary> & { id: string }): ContentSummary {
  return {
    title: "",
    status: "drafted" as ContentStatus,
    scheduledFor: null,
    submissionId: null,
    pillar: null,
    updatedAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...fields,
  };
}

const by = (rows: ContentSummary[], sort: ContentSort) =>
  sortContent(rows, sort).map((r) => r.id);

describe("sortContent", () => {
  it("sorts by title A→Z ascending and Z→A descending", () => {
    const rows = [
      row({ id: "b", title: "Banana" }),
      row({ id: "a", title: "apple" }),
      row({ id: "c", title: "Cherry" }),
    ];
    expect(by(rows, { key: "title", dir: "asc" })).toEqual(["a", "b", "c"]);
    expect(by(rows, { key: "title", dir: "desc" })).toEqual(["c", "b", "a"]);
  });

  it("treats an empty title as 'Untitled idea' when sorting", () => {
    const rows = [
      row({ id: "z", title: "Zebra" }),
      row({ id: "blank", title: "   " }),
      row({ id: "a", title: "Apple" }),
    ];
    // "Untitled idea" falls between Apple and Zebra alphabetically.
    expect(by(rows, { key: "title", dir: "asc" })).toEqual(["a", "blank", "z"]);
  });

  it("sorts status in pipeline order, not alphabetically", () => {
    const rows = [
      row({ id: "posted", status: "posted" }),
      row({ id: "drafted", status: "drafted" }),
      row({ id: "scheduled", status: "scheduled" }),
      row({ id: "planned", status: "planned" }),
    ];
    // Alphabetical would give drafted, planned, posted, scheduled — the point of
    // the rank is that posted comes last.
    expect(by(rows, { key: "status", dir: "asc" })).toEqual([
      "drafted",
      "planned",
      "scheduled",
      "posted",
    ]);
  });

  it("sorts by updated time, newest first when descending", () => {
    const rows = [
      row({ id: "old", updatedAt: "2026-07-01T00:00:00.000Z" }),
      row({ id: "new", updatedAt: "2026-07-09T00:00:00.000Z" }),
      row({ id: "mid", updatedAt: "2026-07-05T00:00:00.000Z" }),
    ];
    expect(by(rows, { key: "updated", dir: "desc" })).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("is stable: rows tied on the sort column keep their incoming order", () => {
    const rows = [
      row({ id: "first", status: "drafted" }),
      row({ id: "second", status: "drafted" }),
      row({ id: "third", status: "drafted" }),
    ];
    // All tie on status, so neither direction may reorder them.
    expect(by(rows, { key: "status", dir: "asc" })).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(by(rows, { key: "status", dir: "desc" })).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ id: "b", title: "B" }), row({ id: "a", title: "A" })];
    const before = rows.map((r) => r.id);
    sortContent(rows, { key: "title", dir: "asc" });
    expect(rows.map((r) => r.id)).toEqual(before);
  });
});
