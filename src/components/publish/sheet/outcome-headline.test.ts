import { describe, expect, it } from "vitest";
import { outcomeHeadline } from "./outcome-headline";
import type { OutcomeRow } from "./outcome-rows";

const row = (
  platform: OutcomeRow["platform"],
  status: OutcomeRow["status"],
) => ({ platform, status });

describe("outcome headline", () => {
  it("says nothing when there is nothing to report", () => {
    expect(outcomeHeadline([], 1)).toBeNull();
  });

  it("names every destination while they go out together", () => {
    expect(
      outcomeHeadline([row("youtube", "posted"), row("tiktok", "sending")], 1),
    ).toEqual({ tone: "sending", text: "Publishing to YouTube and TikTok…" });
  });

  it("names where the video is live", () => {
    expect(
      outcomeHeadline([row("youtube", "posted"), row("tiktok", "posted")], 1),
    ).toEqual({ tone: "done", text: "Posted to YouTube and TikTok" });
    expect(outcomeHeadline([row("youtube", "posted")], 1)?.text).toBe(
      "Posted to YouTube",
    );
  });

  it("says an inbox draft still needs finishing in TikTok", () => {
    expect(
      outcomeHeadline([row("youtube", "posted"), row("tiktok", "draft")], 1)
        ?.text,
    ).toBe("Posted to YouTube and sent to your TikTok inbox");
    expect(outcomeHeadline([row("tiktok", "draft")], 1)).toEqual({
      tone: "done",
      text: "Sent to your TikTok inbox",
    });
  });

  it("puts a failure ahead of everything that worked", () => {
    expect(
      outcomeHeadline([row("youtube", "posted"), row("tiktok", "failed")], 1),
    ).toEqual({ tone: "failed", text: "1 of 2 posts failed" });
    expect(outcomeHeadline([row("tiktok", "failed")], 1)?.text).toBe(
      "Couldn’t post to TikTok",
    );
  });

  it("does not call an unconfirmed post done", () => {
    expect(
      outcomeHeadline([row("youtube", "posted"), row("tiktok", "pending")], 1),
    ).toEqual({ tone: "waiting", text: "Waiting for confirmation" });
  });

  it("counts posts for a batch of videos", () => {
    const rows = [
      row("youtube", "posted"),
      row("tiktok", "posted"),
      row("youtube", "posted"),
      row("tiktok", "sending"),
    ];
    expect(outcomeHeadline(rows, 2)?.text).toBe("Publishing 4 posts…");
    expect(
      outcomeHeadline(
        rows.map((item) => ({ ...item, status: "posted" as const })),
        2,
      )?.text,
    ).toBe("All 4 posts went out");
  });
});
