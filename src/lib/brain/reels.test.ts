import { describe, expect, it } from "vitest";
import {
  ANGLE_REEL,
  FORMAT_REEL,
  recentTitles,
  spinReels,
} from "@/lib/brain/reels";
import { formatsIn } from "@/lib/brain/formats";

/** A random source that walks a fixed sequence, so a spin is reproducible. */
const sequence = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe("spinReels", () => {
  it("deals one of each reel", () => {
    const spun = spinReels(
      { pillars: ["CELPIP tips", "Newcomer life"], formats: [] },
      sequence([0, 0, 0]),
    );
    expect(spun.pillar).toBe("CELPIP tips");
    expect(ANGLE_REEL).toContain(spun.angle);
    expect(FORMAT_REEL).toContain(spun.format);
  });

  it("prefers the creator's own formats over the general ones", () => {
    const spun = spinReels(
      { pillars: ["Anything"], formats: ["me, a whiteboard, no cuts"] },
      sequence([0, 0, 0]),
    );
    expect(spun.format).toBe("me, a whiteboard, no cuts");
  });

  it("survives a creator with no pillars yet", () => {
    const spun = spinReels({ pillars: [], formats: [] }, sequence([0.5]));
    expect(spun.pillar).toBe("");
    expect(spun.angle).toBeTruthy();
  });

  it("stays in range at the top of the random interval", () => {
    // Math.random() is [0, 1), but a caller passing 0.999999 must not index
    // past the end of a reel and deal undefined.
    const spun = spinReels(
      { pillars: ["Only one"], formats: [] },
      sequence([0.999999]),
    );
    expect(spun.pillar).toBe("Only one");
    expect(ANGLE_REEL).toContain(spun.angle);
  });
});

describe("recentTitles", () => {
  it("drops blanks and caps the list", () => {
    const titles = recentTitles(["  ", "One", "Two", "Three"], 2);
    expect(titles).toEqual(["One", "Two"]);
  });
});

describe("formatsIn", () => {
  const block = (title: string, items: string[], body = "") => ({
    title,
    kind: (items.length ? "list" : "note") as "list" | "note",
    body,
    items,
  });

  it("finds the creator's formats whatever they called the section", () => {
    expect(
      formatsIn([block("Shapes I shoot", ["talking head", "walk and talk"])]),
    ).toEqual(["talking head", "walk and talk"]);
  });

  it("reads a prose section as lines", () => {
    expect(
      formatsIn([block("Formats", [], "- talking head\n- demo\n")]),
    ).toEqual(["talking head", "demo"]);
  });

  it("returns nothing when no section is about formats", () => {
    expect(formatsIn([block("Why I post", [], "To sell the app.")])).toEqual(
      [],
    );
  });
});
