import { describe, expect, it } from "vitest";
import {
  addBlock,
  changeBlockKind,
  isListKind,
  moveBlock,
  removeBlock,
  updateBlock,
} from "@/lib/content/block-edits";
import type { ContentBlock } from "@/lib/db/schema";

const prose: ContentBlock = {
  label: "Breakdown",
  kind: "paragraph",
  text: "one\ntwo",
};
const list: ContentBlock = {
  label: "Beats",
  kind: "bullets",
  items: ["a", "b"],
};

describe("isListKind", () => {
  it("separates list kinds from prose kinds", () => {
    expect(isListKind("bullets")).toBe(true);
    expect(isListKind("steps")).toBe(true);
    expect(isListKind("paragraph")).toBe(false);
    expect(isListKind("script")).toBe(false);
  });
});

describe("changeBlockKind", () => {
  it("splits prose into items when moving to a list", () => {
    const [block] = changeBlockKind([prose], 0, "bullets");
    expect(block).toEqual({
      label: "Breakdown",
      kind: "bullets",
      items: ["one", "two"],
    });
    // The prose side is gone, not carried alongside: a block holding both
    // would lose one of them on the next normalize.
    expect(block.text).toBeUndefined();
  });

  it("joins items back into prose when leaving a list", () => {
    const [block] = changeBlockKind([list], 0, "paragraph");
    expect(block).toEqual({
      label: "Beats",
      kind: "paragraph",
      text: "a\nb",
    });
    expect(block.items).toBeUndefined();
  });

  it("round-trips prose through a list without losing lines", () => {
    const once = changeBlockKind([prose], 0, "steps");
    const back = changeBlockKind(once, 0, "paragraph");
    expect(back[0].text).toBe("one\ntwo");
  });

  it("keeps content when both kinds are on the same side", () => {
    expect(changeBlockKind([list], 0, "steps")[0]).toEqual({
      ...list,
      kind: "steps",
    });
    expect(changeBlockKind([prose], 0, "script")[0]).toEqual({
      ...prose,
      kind: "script",
    });
  });

  it("leaves other blocks untouched", () => {
    const out = changeBlockKind([prose, list], 1, "paragraph");
    expect(out[0]).toBe(prose);
  });
});

describe("moveBlock", () => {
  it("swaps with the neighbour in the given direction", () => {
    expect(moveBlock([prose, list], 0, 1)).toEqual([list, prose]);
    expect(moveBlock([prose, list], 1, -1)).toEqual([list, prose]);
  });

  it("is a no-op at either end", () => {
    const blocks = [prose, list];
    expect(moveBlock(blocks, 0, -1)).toBe(blocks);
    expect(moveBlock(blocks, 1, 1)).toBe(blocks);
  });

  it("is a no-op for an index that is not there", () => {
    const blocks = [prose];
    expect(moveBlock(blocks, 5, -1)).toBe(blocks);
  });
});

describe("add / remove / update", () => {
  it("appends a usable empty block", () => {
    const out = addBlock([prose]);
    expect(out).toHaveLength(2);
    expect(out[1].kind).toBe("paragraph");
  });

  it("removes only the indexed block", () => {
    expect(removeBlock([prose, list], 0)).toEqual([list]);
  });

  it("patches one block without touching the rest", () => {
    const out = updateBlock([prose, list], 1, { label: "Renamed" });
    expect(out[1].label).toBe("Renamed");
    expect(out[1].items).toEqual(["a", "b"]);
    expect(out[0]).toBe(prose);
  });

  it("does not mutate the input array", () => {
    const blocks = [prose];
    addBlock(blocks);
    removeBlock(blocks, 0);
    updateBlock(blocks, 0, { label: "x" });
    expect(blocks).toEqual([prose]);
  });
});
