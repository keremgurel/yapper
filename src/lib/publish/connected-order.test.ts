import { describe, expect, it } from "vitest";
import { connectedInOrder } from "@/lib/publish/connected-order";

describe("connectedInOrder", () => {
  it("returns platforms in canonical order regardless of input order", () => {
    expect(connectedInOrder(["instagram", "youtube"])).toEqual([
      "youtube",
      "instagram",
    ]);
    expect(connectedInOrder(["tiktok", "instagram", "youtube"])).toEqual([
      "youtube",
      "tiktok",
      "instagram",
    ]);
  });

  it("dedupes repeats", () => {
    expect(connectedInOrder(["instagram", "instagram", "youtube"])).toEqual([
      "youtube",
      "instagram",
    ]);
  });

  it("keeps only connected platforms", () => {
    expect(connectedInOrder(["tiktok"])).toEqual(["tiktok"]);
    expect(connectedInOrder([])).toEqual([]);
  });
});
