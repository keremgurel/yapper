import { describe, expect, it } from "vitest";
import {
  applyLayoutToCaptions,
  applyStyleToCaptions,
} from "@/lib/studio/caption-apply";
import type { Caption } from "@/lib/studio/types";

const cap = (over: Partial<Caption>): Caption => ({
  id: "c",
  text: "hi",
  sourceStart: 0,
  sourceEnd: 1,
  ...over,
});

describe("applyStyleToCaptions", () => {
  it("clears matching per-caption overrides when applying to all", () => {
    // A global case change must strip every caption's own textCase, or the
    // override would keep winning and the global change wouldn't show.
    const out = applyStyleToCaptions(
      [cap({ id: "a", textCase: "upper" }), cap({ id: "b" })],
      true,
      new Set(),
      { textCase: "lower" },
    );
    expect(out[0].textCase).toBeUndefined();
    expect(out[1].textCase).toBeUndefined();
  });

  it("writes the override onto only the selected captions when apply-all is off", () => {
    const out = applyStyleToCaptions(
      [cap({ id: "a" }), cap({ id: "b" })],
      false,
      new Set(["a"]),
      { fontFamily: "Serif" },
    );
    expect(out[0].fontFamily).toBe("Serif");
    expect(out[1].fontFamily).toBeUndefined();
  });

  it("is a no-op by reference when apply-all is off and nothing is selected", () => {
    const captions = [cap({ id: "a" })];
    expect(
      applyStyleToCaptions(captions, false, new Set(), { scale: 0.1 }),
    ).toBe(captions);
  });
});

describe("applyLayoutToCaptions", () => {
  it("clears overrides only for the fields the layout changed (apply-all)", () => {
    const out = applyLayoutToCaptions(
      [cap({ id: "a", x: 0.1, y: 0.2 })],
      true,
      "a",
      { x: 0.5 }, // only x changed
    );
    expect(out[0].x).toBeUndefined(); // cleared, so the new global x wins
    expect(out[0].y).toBe(0.2); // untouched: y wasn't in the layout
  });

  it("writes the layout onto the one targeted caption when apply-all is off", () => {
    const out = applyLayoutToCaptions(
      [cap({ id: "a" }), cap({ id: "b" })],
      false,
      "a",
      { x: 0.5, scale: 0.08 },
    );
    expect(out[0]).toMatchObject({ x: 0.5, scale: 0.08 });
    expect(out[1].x).toBeUndefined();
  });
});
