import { describe, expect, it } from "vitest";

import {
  evaluateDestination,
  publishSummary,
  type DestinationInput,
} from "@/lib/publish/destination-readiness";
import { blankCaption } from "@/components/publish/captions/caption-draft";
import type { PublishPlatform } from "@/lib/db/schema";

function input(
  platform: PublishPlatform,
  overrides: Partial<DestinationInput> = {},
): DestinationInput {
  return {
    platform,
    connected: true,
    caption: blankCaption(platform),
    hasCover: true,
    ...overrides,
  };
}

describe("evaluateDestination", () => {
  it("reports a disconnected platform before anything else", () => {
    const r = evaluateDestination(input("tiktok", { connected: false }));
    expect(r.state).toBe("disconnected");
    expect(r.blockers[0]).toContain("Connect");
  });

  it("treats an untouched destination as empty rather than blocked", () => {
    // Nothing typed yet is not an error, it is just not started. Showing it as
    // blocked would light the card up red before anyone had done anything.
    expect(evaluateDestination(input("tiktok")).state).toBe("empty");
  });

  it("requires a title only where the platform has one", () => {
    const youtube = evaluateDestination(
      input("youtube", {
        caption: { ...blankCaption("youtube"), body: "A body with no title." },
      }),
    );
    expect(youtube.blockers).toContain("A title is required.");

    const tiktok = evaluateDestination(
      input("tiktok", {
        caption: { ...blankCaption("tiktok"), body: "A body with no title." },
      }),
    );
    expect(tiktok.blockers).toHaveLength(0);
    expect(tiktok.state).toBe("ready");
  });

  it("counts an over-long caption as a blocker with the overage", () => {
    const r = evaluateDestination(
      input("tiktok", {
        caption: { ...blankCaption("tiktok"), body: "x".repeat(2250) },
      }),
    );
    expect(r.state).toBe("blocked");
    expect(r.blockers.some((b) => b.includes("50 over the 2200"))).toBe(true);
  });

  it("always states what posting actually does on that platform", () => {
    // TikTok lands in drafts rather than posting, which is the single most
    // surprising thing about cross-posting and must never be a surprise.
    const r = evaluateDestination(
      input("tiktok", {
        caption: { ...blankCaption("tiktok"), body: "Ready to go." },
      }),
    );
    expect(r.notes.length).toBeGreaterThan(0);
  });

  it("warns about Instagram's professional account requirement", () => {
    const r = evaluateDestination(
      input("instagram", {
        caption: { ...blankCaption("instagram"), body: "Ready to go." },
      }),
    );
    expect(r.notes.some((n) => n.includes("Professional"))).toBe(true);
  });

  it("lets a finished job outrank every other check", () => {
    const r = evaluateDestination(
      input("youtube", { connected: false, outcome: "posted" }),
    );
    expect(r.state).toBe("posted");
    expect(r.blockers).toHaveLength(0);
  });
});

describe("publishSummary", () => {
  it("counts only what can actually go", () => {
    const ready = evaluateDestination(
      input("tiktok", {
        caption: { ...blankCaption("tiktok"), body: "Ready." },
      }),
    );
    const blocked = evaluateDestination(
      input("youtube", {
        caption: { ...blankCaption("youtube"), body: "No title." },
      }),
    );
    const summary = publishSummary([ready, blocked]);
    expect(summary.ready).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.canPublish).toBe(true);
    expect(summary.label).toBe("Publish to 1 destination");
  });

  it("cannot publish when nothing is ready", () => {
    const summary = publishSummary([evaluateDestination(input("tiktok"))]);
    expect(summary.canPublish).toBe(false);
    expect(summary.label).toBe("Nothing ready to publish");
  });
});
