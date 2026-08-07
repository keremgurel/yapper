import { describe, expect, it } from "vitest";
import {
  HOOK_PATTERNS,
  hookPattern,
  hookPatternBlock,
  hookPatternName,
} from "@/lib/content/hook-patterns";

describe("the pattern library", () => {
  /** Ids are stored on every generated hook. A duplicate would make one of them
   * unresolvable, and the chip would silently name the wrong mechanism. */
  it("has unique ids", () => {
    const ids = HOOK_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every pattern the fields the prompt renders", () => {
    HOOK_PATTERNS.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.mechanism).toBeTruthy();
      expect(p.whenToUse).toBeTruthy();
      expect(p.shape).toBeTruthy();
      expect(p.example).toBeTruthy();
    });
  });

  /** The block rides on every hook call, so its size is a standing cost. At
   * roughly 4 chars per token the full menu is about 390 tokens; the bound is
   * here so adding a pattern is a deliberate trade rather than a silent one. */
  it("stays within its token budget", () => {
    expect(hookPatternBlock().length).toBeLessThan(1700);
  });

  it("costs materially less when narrowed to one pattern", () => {
    expect(hookPatternBlock("stakes").length * 4).toBeLessThan(
      hookPatternBlock().length,
    );
  });
});

describe("hookPattern", () => {
  it("resolves a known id and rejects the rest", () => {
    expect(hookPattern("stakes")?.name).toBe("Stakes first");
    expect(hookPattern("nope")).toBeNull();
    expect(hookPattern(null)).toBeNull();
    expect(hookPattern(undefined)).toBeNull();
  });
});

describe("hookPatternName", () => {
  it("names a known pattern", () => {
    expect(hookPatternName("negation")).toBe("Stop doing X");
  });

  /** A hook generated against a pattern that was later retired keeps its raw id
   * rather than losing the attribution entirely. */
  it("falls back to the raw id for an unknown pattern", () => {
    expect(hookPatternName("retired-pattern")).toBe("retired-pattern");
    expect(hookPatternName(null)).toBeNull();
  });
});

describe("hookPatternBlock", () => {
  it("lists everything when unfiltered", () => {
    const block = hookPatternBlock();
    HOOK_PATTERNS.forEach((p) => expect(block).toContain(p.name));
  });

  it("narrows to a single pattern", () => {
    const block = hookPatternBlock("pov");
    expect(block).toContain("POV framing");
    expect(block).not.toContain("Stakes first");
  });

  it("is empty for an unknown filter rather than silently full", () => {
    expect(hookPatternBlock("nope")).toBe("");
  });
});
