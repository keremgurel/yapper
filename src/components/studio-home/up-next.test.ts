import { describe, expect, it } from "vitest";
import { upNextItems } from "@/components/studio-home/up-next";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

const item = (
  fields: Partial<ContentSummary> & { id: string },
): ContentSummary =>
  ({
    title: "",
    status: "drafted" as ContentStatus,
    stage: "library",
    formats: [],
    ideaType: null,
    scheduledFor: null,
    submissionId: null,
    pillar: null,
    pillarId: null,
    sourceUrl: null,
    sourceTitle: null,
    sourcePlatform: null,
    transcriptStatus: null,
    script: null,
    originalNote: "",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...fields,
  }) as ContentSummary;

describe("upNextItems", () => {
  it("puts dated work ahead of drafts", () => {
    const out = upNextItems([
      item({ id: "draft", updatedAt: "2026-05-01T00:00:00.000Z" }),
      item({
        id: "sched",
        status: "scheduled",
        scheduledFor: "2026-09-01T00:00:00.000Z",
      }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["sched", "draft"]);
  });

  it("orders dated work by when it goes out, soonest first", () => {
    const out = upNextItems([
      item({
        id: "late",
        status: "scheduled",
        scheduledFor: "2026-12-01T00:00:00.000Z",
      }),
      item({
        id: "soon",
        status: "scheduled",
        scheduledFor: "2026-02-01T00:00:00.000Z",
      }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["soon", "late"]);
  });

  it("orders undated work by most recently touched", () => {
    const out = upNextItems([
      item({ id: "stale", updatedAt: "2026-01-01T00:00:00.000Z" }),
      item({ id: "fresh", updatedAt: "2026-06-01T00:00:00.000Z" }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["fresh", "stale"]);
  });

  /** A row can carry status `scheduled` with no date: the bulk bar refuses to
   * set one, but a direct edit can clear the date and leave the status. It has
   * to fall through to the recency group, because sorting it as dated work
   * would rank an empty string ahead of every real date. */
  it("treats a scheduled item with no date as undated", () => {
    const out = upNextItems([
      item({
        id: "dated",
        status: "scheduled",
        scheduledFor: "2026-03-01T00:00:00.000Z",
      }),
      item({ id: "dateless", status: "scheduled", scheduledFor: null }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["dated", "dateless"]);
  });

  /** Posted work is finished. Home answers "what is left", so it stays out
   * however recently it was touched. */
  it("leaves posted work out entirely", () => {
    const out = upNextItems([
      item({ id: "done", status: "posted", updatedAt: "2026-12-31T00:00:00Z" }),
      item({ id: "todo" }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["todo"]);
  });

  it("caps the list, keeping the highest priority rows", () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      item({ id: `d${i}`, updatedAt: `2026-01-0${i + 1}T00:00:00.000Z` }),
    );
    expect(upNextItems(rows)).toHaveLength(5);
    expect(upNextItems(rows, 2).map((r) => r.id)).toEqual(["d8", "d7"]);
  });

  it("is empty when there is nothing left to do", () => {
    expect(upNextItems([])).toEqual([]);
    expect(upNextItems([item({ id: "a", status: "posted" })])).toEqual([]);
  });
});
