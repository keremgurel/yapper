import { describe, expect, it } from "vitest";
import { RECENT_VIDEOS, selectVideos, wantsPoster } from "./reads";

type Row = Parameters<typeof selectVideos>[0][number];

function row(id: number, title: string, extra: Partial<Row> = {}): Row {
  return {
    id: `v${id}`,
    title,
    submissionId: `s${id}`,
    sourceUrl: null,
    ...extra,
  } as Row;
}

describe("wantsPoster", () => {
  it("reads Poster data on Poster and the calendar, or for a posting request", () => {
    expect(wantsPoster("/studio/poster", "hi")).toBe(true);
    expect(wantsPoster("/studio/calendar", "what's on friday")).toBe(true);
    expect(wantsPoster("/studio/ideas", "post the gym one to TikTok")).toBe(
      true,
    );
    expect(wantsPoster("/studio/ideas", "rename the gym idea")).toBe(false);
  });
});

describe("selectVideos", () => {
  it("lists recent postable videos and older ones the request names", () => {
    const rows = [
      row(0, "No file yet", { submissionId: null }),
      row(1, "Already sent", { sourceUrl: "yapper://poster-upload/completed" }),
      ...Array.from({ length: RECENT_VIDEOS }, (_, i) =>
        row(i + 2, `Recent ${i}`),
      ),
      row(99, "Desk tour behind the scenes"),
      row(100, "Unrelated old clip"),
    ];
    const chosen = selectVideos(rows, "post the desk tour").map((r) => r.id);
    expect(chosen).toHaveLength(RECENT_VIDEOS + 1);
    expect(chosen).toContain("v99");
    expect(chosen).not.toContain("v0");
    expect(chosen).not.toContain("v1");
    expect(chosen).not.toContain("v100");
  });
});
