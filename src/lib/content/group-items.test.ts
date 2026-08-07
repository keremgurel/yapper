import { describe, expect, it } from "vitest";
import { applyViewFilters, groupItems } from "@/lib/content/group-items";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

const row = (
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
    updatedAt: "",
    createdAt: "",
    ...fields,
  }) as ContentSummary;

describe("applyViewFilters", () => {
  const rows = [
    row({ id: "a", status: "drafted", formats: ["short"] }),
    row({ id: "b", status: "posted", formats: ["short", "article"] }),
    row({ id: "c", status: "drafted", pillarId: "p1" }),
  ];

  it("does not narrow anything when the view has no filters", () => {
    expect(applyViewFilters(rows, {})).toHaveLength(3);
  });

  it("keeps only the wanted statuses", () => {
    expect(
      applyViewFilters(rows, { status: ["drafted"] }).map((r) => r.id),
    ).toEqual(["a", "c"]);
  });

  /** Matching any one wanted format is a hit: "show me shorts" should still
   * surface something that is a short and an article. */
  it("matches an item that holds any of the wanted formats", () => {
    expect(
      applyViewFilters(rows, { formats: ["article"] }).map((r) => r.id),
    ).toEqual(["b"]);
    expect(
      applyViewFilters(rows, { formats: ["short"] }).map((r) => r.id),
    ).toEqual(["a", "b"]);
  });

  it("combines filters with AND", () => {
    expect(
      applyViewFilters(rows, { status: ["drafted"], formats: ["short"] }).map(
        (r) => r.id,
      ),
    ).toEqual(["a"]);
  });

  it("filters by pillar", () => {
    expect(
      applyViewFilters(rows, { pillarId: ["p1"] }).map((r) => r.id),
    ).toEqual(["c"]);
  });
});

describe("groupItems", () => {
  it("is one flat group when nothing groups it", () => {
    const groups = groupItems([row({ id: "a" })], null);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(1);
  });

  /** Every status column exists even when empty: an empty "Scheduled" says
   * nothing is queued, and the board needs it as a drop target regardless. */
  it("keeps every status group, in pipeline order", () => {
    const groups = groupItems([row({ id: "a", status: "posted" })], "status");
    expect(groups.map((g) => g.key)).toEqual([
      "drafted",
      "planned",
      "scheduled",
      "posted",
    ]);
    expect(groups[3].items).toHaveLength(1);
  });

  it("shows only formats that something is in", () => {
    const groups = groupItems([row({ id: "a", formats: ["short"] })], "format");
    expect(groups.map((g) => g.key)).toEqual(["short"]);
  });

  it("puts items with no format in their own bucket", () => {
    const groups = groupItems(
      [row({ id: "a", formats: ["short"] }), row({ id: "b" })],
      "format",
    );
    expect(groups.map((g) => g.key)).toEqual(["short", "__none"]);
  });

  it("lists an item under each format it holds", () => {
    const groups = groupItems(
      [row({ id: "a", formats: ["short", "article"] })],
      "format",
    );
    expect(groups.map((g) => g.key)).toEqual(["short", "article"]);
  });

  it("sorts pillars alphabetically and unclassified last", () => {
    const groups = groupItems(
      [
        row({ id: "a" }),
        row({ id: "b", pillarId: "p2", pillar: "Zed" }),
        row({ id: "c", pillarId: "p1", pillar: "Alpha" }),
      ],
      "pillar",
    );
    expect(groups.map((g) => g.label)).toEqual(["Alpha", "Zed", "No pillar"]);
  });
});
