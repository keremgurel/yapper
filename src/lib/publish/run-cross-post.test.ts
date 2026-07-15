import { describe, expect, it } from "vitest";
import {
  crossPostOutcomeSummary,
  runCrossPost,
} from "@/lib/publish/run-cross-post";
import type { CrossPostResult } from "@/lib/publish/client";
import type { PublishPlatform } from "@/lib/db/schema";

const targets = (...ps: PublishPlatform[]) =>
  ps.map((platform) => ({ platform }));

describe("runCrossPost", () => {
  it("maps a live post to posted (with its url) and a draft landing to draft", async () => {
    const out = await runCrossPost(
      targets("youtube", "tiktok"),
      async (p): Promise<CrossPostResult> =>
        p === "tiktok"
          ? { jobId: "j", draft: true }
          : { jobId: "j", url: "https://x/y" },
    );
    expect(out).toEqual([
      { platform: "youtube", status: "posted", url: "https://x/y" },
      { platform: "tiktok", status: "draft", url: undefined },
    ]);
  });

  it("isolates a failure so the other platforms still post", async () => {
    const out = await runCrossPost(
      targets("youtube", "instagram"),
      async (p): Promise<CrossPostResult> => {
        if (p === "youtube") throw new Error("not_connected");
        return { jobId: "j", url: "https://ig/1" };
      },
    );
    expect(out[0]).toEqual({
      platform: "youtube",
      status: "failed",
      error: "not_connected",
    });
    expect(out[1]).toEqual({
      platform: "instagram",
      status: "posted",
      url: "https://ig/1",
    });
  });

  it("keeps output order aligned with the targets", async () => {
    const out = await runCrossPost(
      targets("instagram", "youtube", "tiktok"),
      async (): Promise<CrossPostResult> => ({ jobId: "j" }),
    );
    expect(out.map((o) => o.platform)).toEqual([
      "instagram",
      "youtube",
      "tiktok",
    ]);
  });
});

describe("crossPostOutcomeSummary", () => {
  it("tallies posted, draft, and failed", () => {
    expect(
      crossPostOutcomeSummary([
        { platform: "youtube", status: "posted" },
        { platform: "instagram", status: "posted" },
        { platform: "tiktok", status: "draft" },
      ]),
    ).toEqual({ posted: 2, draft: 1, failed: 0 });
    expect(
      crossPostOutcomeSummary([{ platform: "youtube", status: "failed" }]),
    ).toEqual({ posted: 0, draft: 0, failed: 1 });
  });
});
