import { describe, expect, it } from "vitest";
import { postableVideos } from "@/lib/publish/postable-videos";
import type { ContentSummary } from "@/lib/content/client";

function item(
  fields: Partial<ContentSummary> & { id: string },
): ContentSummary {
  return {
    title: "A video",
    status: "drafted",
    scheduledFor: null,
    submissionId: null,
    pillar: null,
    updatedAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...fields,
  };
}

describe("postableVideos", () => {
  it("keeps only items that have a recorded submission", () => {
    const out = postableVideos([
      item({ id: "a", submissionId: "sub-a" }),
      item({ id: "b", submissionId: null }),
    ]);
    expect(out.map((v) => v.id)).toEqual(["a"]);
    expect(out[0].submissionId).toBe("sub-a");
  });

  it("orders postable takes newest first", () => {
    const out = postableVideos([
      item({
        id: "old",
        submissionId: "s1",
        updatedAt: "2026-07-01T00:00:00.000Z",
      }),
      item({
        id: "new",
        submissionId: "s2",
        updatedAt: "2026-07-09T00:00:00.000Z",
      }),
    ]);
    expect(out.map((v) => v.id)).toEqual(["new", "old"]);
  });

  it("falls back to Untitled for a blank title", () => {
    const out = postableVideos([
      item({ id: "a", submissionId: "s", title: "   " }),
    ]);
    expect(out[0].title).toBe("Untitled");
  });

  it("returns an empty list for null (not-yet-loaded) items", () => {
    expect(postableVideos(null)).toEqual([]);
  });
});
