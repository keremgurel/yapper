import { describe, expect, it } from "vitest";
import {
  normalizeBlocks,
  normalizeBody,
  normalizeHooks,
  usesLegacyBody,
} from "@/lib/content/normalize";

describe("normalizeHooks", () => {
  it("widens legacy plain strings into untagged hooks", () => {
    expect(normalizeHooks(["Stop saying um.", "  Sound sharp.  "])).toEqual([
      { text: "Stop saying um.", pattern: null, why: null },
      { text: "Sound sharp.", pattern: null, why: null },
    ]);
  });

  it("keeps the pattern and reasoning on new hooks", () => {
    expect(
      normalizeHooks([
        { text: "Nobody passes on vocabulary.", pattern: "negation", why: "x" },
      ]),
    ).toEqual([
      { text: "Nobody passes on vocabulary.", pattern: "negation", why: "x" },
    ]);
  });

  it("drops blanks, non-strings and objects with no text", () => {
    expect(normalizeHooks(["", "  ", 5, null, {}, { text: "  " }])).toEqual([]);
  });

  it("returns empty for a non-array", () => {
    expect(normalizeHooks(undefined)).toEqual([]);
    expect(normalizeHooks("hook")).toEqual([]);
  });
});

describe("normalizeBlocks", () => {
  it("keeps well-formed blocks", () => {
    expect(
      normalizeBlocks([
        { label: "Joke mechanics", kind: "bullets", items: ["a", "b"] },
        { label: "Draft", kind: "script", text: "Say this." },
      ]),
    ).toEqual([
      { label: "Joke mechanics", kind: "bullets", items: ["a", "b"] },
      { label: "Draft", kind: "script", text: "Say this." },
    ]);
  });

  it("drops blocks with an unknown kind, no label, or no content", () => {
    expect(
      normalizeBlocks([
        { label: "Bad kind", kind: "table", text: "x" },
        { label: "", kind: "paragraph", text: "x" },
        { label: "Empty", kind: "bullets", items: [] },
        { label: "Good", kind: "paragraph", text: "Keep." },
      ]),
    ).toEqual([{ label: "Good", kind: "paragraph", text: "Keep." }]);
  });
});

describe("normalizeBody", () => {
  it("reconstructs blocks from the legacy columns", () => {
    const body = normalizeBody({
      hooks: ["A hook"],
      points: ["Point one", "Point two"],
      example: "A concrete moment.",
      cta: "Follow for more.",
    });

    expect(body.hooks).toEqual([{ text: "A hook", pattern: null, why: null }]);
    expect(body.blocks).toEqual([
      {
        label: "Key points",
        kind: "bullets",
        items: ["Point one", "Point two"],
      },
      { label: "Example", kind: "paragraph", text: "A concrete moment." },
      { label: "Call to action", kind: "paragraph", text: "Follow for more." },
    ]);
  });

  it("omits legacy blocks whose column is empty", () => {
    const body = normalizeBody({ points: [], example: "  ", cta: "Do it." });
    expect(body.blocks).toEqual([
      { label: "Call to action", kind: "paragraph", text: "Do it." },
    ]);
  });

  it("prefers stored blocks and does NOT append stale legacy columns", () => {
    const body = normalizeBody({
      blocks: [{ label: "Beat-by-beat", kind: "steps", items: ["one"] }],
      points: ["a stale point"],
      example: "a stale example",
      cta: "a stale cta",
    });
    // A row that has a real body must render exactly that body; re-appending
    // the superseded columns would resurrect edits the creator deleted.
    expect(body.blocks).toEqual([
      { label: "Beat-by-beat", kind: "steps", items: ["one"] },
    ]);
  });

  it("yields an empty body for an empty row", () => {
    expect(normalizeBody({})).toEqual({ hooks: [], blocks: [] });
  });
});

describe("usesLegacyBody", () => {
  it("is true only while a row has no blocks but does have legacy content", () => {
    expect(usesLegacyBody({ points: ["x"] })).toBe(true);
    expect(usesLegacyBody({ example: "x" })).toBe(true);
    expect(usesLegacyBody({ cta: "x" })).toBe(true);
    expect(usesLegacyBody({})).toBe(false);
    expect(
      usesLegacyBody({
        blocks: [{ label: "L", kind: "paragraph", text: "t" }],
        points: ["x"],
      }),
    ).toBe(false);
  });
});
