import { describe, expect, it } from "vitest";
import {
  crossPostSummary,
  crossPostTargets,
} from "@/lib/publish/cross-post-plan";

describe("crossPostTargets", () => {
  it("returns targets in the canonical platform order, not the input order", () => {
    const out = crossPostTargets(["instagram", "youtube"]);
    expect(out.map((t) => t.platform)).toEqual(["youtube", "instagram"]);
  });

  it("dedupes a platform that appears more than once", () => {
    const out = crossPostTargets(["tiktok", "tiktok"]);
    expect(out).toHaveLength(1);
    expect(out[0].platform).toBe("tiktok");
  });

  it("annotates each target from the platform spec", () => {
    const [ig] = crossPostTargets(["instagram"]);
    expect(ig.label).toBe("Instagram");
    expect(ig.mode).toBe("direct");
    expect(ig.requiresProfessional).toBe(true);
    const [tt] = crossPostTargets(["tiktok"]);
    expect(tt.mode).toBe("draft-inbox");
    expect(tt.requiresProfessional).toBe(false);
  });

  it("drops an unknown platform id rather than trusting it", () => {
    const out = crossPostTargets([
      "youtube",
      "myspace" as unknown as "youtube",
    ]);
    expect(out.map((t) => t.platform)).toEqual(["youtube"]);
  });

  it("is empty when nothing is connected", () => {
    expect(crossPostTargets([])).toEqual([]);
  });
});

describe("crossPostSummary", () => {
  it("counts direct posts and draft-inbox posts separately", () => {
    // youtube + instagram are direct; tiktok is draft-inbox.
    const s = crossPostSummary(
      crossPostTargets(["youtube", "tiktok", "instagram"]),
    );
    expect(s).toEqual({ total: 3, direct: 2, draftInbox: 1 });
  });

  it("is all zeros for no targets", () => {
    expect(crossPostSummary([])).toEqual({
      total: 0,
      direct: 0,
      draftInbox: 0,
    });
  });
});
