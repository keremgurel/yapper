import { describe, expect, it } from "vitest";
import { outcomeRows, type SourceOutcome } from "./outcome-rows";

const video = { id: "v1", title: "Clip" };
const posted: SourceOutcome = {
  sourceId: "v1",
  sourceTitle: "Clip",
  platform: "youtube",
  status: "posted",
  url: "https://youtu.be/x",
};

describe("outcome rows", () => {
  it("shows nothing before a publish starts", () => {
    expect(outcomeRows([video], ["youtube", "tiktok"], [], false)).toEqual([]);
  });

  it("shows every destination as sending the moment a publish starts", () => {
    expect(
      outcomeRows([video], ["youtube", "tiktok"], [], true).map(
        (row) => `${row.platform}:${row.status}`,
      ),
    ).toEqual(["youtube:sending", "tiktok:sending"]);
  });

  it("flips each destination to its own result as it lands", () => {
    expect(
      outcomeRows([video], ["youtube", "tiktok"], [posted], true).map(
        (row) => `${row.platform}:${row.status}`,
      ),
    ).toEqual(["youtube:posted", "tiktok:sending"]);
  });

  it("keeps the chosen order when results land out of order", () => {
    const tiktok: SourceOutcome = { ...posted, platform: "tiktok" };
    expect(
      outcomeRows([video], ["youtube", "tiktok"], [tiktok, posted], false).map(
        (row) => row.platform,
      ),
    ).toEqual(["youtube", "tiktok"]);
  });

  it("keeps a result for a destination that is no longer chosen", () => {
    expect(outcomeRows([video], ["tiktok"], [posted], false)).toEqual([posted]);
  });
});
