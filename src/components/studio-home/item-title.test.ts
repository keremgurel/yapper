import { describe, expect, it } from "vitest";
import { itemTitle } from "@/components/studio-home/item-title";

const item = (over: Partial<Parameters<typeof itemTitle>[0]> = {}) => ({
  title: "",
  sourceTitle: null,
  originalNote: "",
  ...over,
});

describe("itemTitle", () => {
  it("prefers the item's own title", () => {
    expect(
      itemTitle(
        item({ title: "Mine", sourceTitle: "Theirs", originalNote: "Note" }),
      ),
    ).toBe("Mine");
  });

  /** An idea captured from a reference has no title until the AI expansion
   * returns, so the reference's own title is the next best thing to show. */
  it("falls back to the reference title", () => {
    expect(
      itemTitle(item({ sourceTitle: "A Reel", originalNote: "Note" })),
    ).toBe("A Reel");
  });

  it("falls back to the creator's own words", () => {
    expect(itemTitle(item({ originalNote: "the thing I said" }))).toBe(
      "the thing I said",
    );
  });

  it("never renders an empty row", () => {
    expect(itemTitle(item())).toBe("Untitled idea");
  });
});
