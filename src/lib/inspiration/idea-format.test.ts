import { describe, expect, it } from "vitest";
import { ideaToScript, type ScriptSource } from "@/lib/inspiration/idea-format";

const blank: ScriptSource = {
  title: "",
  hooks: [],
  points: [],
  example: "",
  cta: "",
  script: null,
};

describe("ideaToScript", () => {
  it("lays out every section in order, numbering hooks and bulleting points", () => {
    const out = ideaToScript({
      title: "  My Idea  ",
      hooks: ["hook one", "  ", "hook two"],
      points: ["point a", "point b"],
      example: "an example",
      cta: "follow me",
      script: "line1\nline2",
    });
    expect(out).toBe(
      `My Idea

HOOK OPTIONS
1. hook one
2. hook two

KEY POINTS
- point a
- point b

EXAMPLE
an example

CTA
follow me

SCRIPT
line1
line2`,
    );
  });

  it("falls back to a placeholder title and skips every empty section", () => {
    const out = ideaToScript({
      ...blank,
      title: "   ",
      hooks: ["  "],
      points: ["only point"],
    });
    expect(out).toBe(`Untitled idea

KEY POINTS
- only point`);
  });

  it("numbers hooks continuously after dropping blank ones", () => {
    const out = ideaToScript({
      ...blank,
      title: "T",
      hooks: ["a", "  ", "b", "c"],
    });
    expect(out).toBe(`T

HOOK OPTIONS
1. a
2. b
3. c`);
  });

  it("trims the trailing blank line left by the last section", () => {
    const out = ideaToScript({ ...blank, title: "T", cta: "do this" });
    expect(out).toBe(`T

CTA
do this`);
  });
});
