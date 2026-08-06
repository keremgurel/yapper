import { describe, expect, it } from "vitest";
import {
  buildProjectContext,
  projectContextSection,
  type PillarContextSource,
  type ProjectContextSource,
} from "@/lib/content/project-context";

function project(
  fields: Partial<ProjectContextSource> = {},
): ProjectContextSource {
  return {
    name: "CELPIP Speaking",
    whatIMake: "Short-form video for people preparing for the CELPIP exam.",
    audience: "Newcomers to Canada, anxious about the speaking section.",
    voice: "Direct, warm, no corporate filler.",
    offers: "The practice app, the referral program.",
    doNots: "Never promise a guaranteed score.",
    ...fields,
  };
}

function pillar(
  fields: Partial<PillarContextSource> & { name: string },
): PillarContextSource {
  return { description: "", examples: [], ...fields };
}

describe("buildProjectContext", () => {
  it("renders the project fields and pillars as a stable block", () => {
    const block = buildProjectContext(project(), [
      pillar({
        name: "Question walkthroughs",
        description: "One real task, answered live.",
        examples: ["Task 5 in 60 seconds"],
      }),
    ]);

    expect(block).toContain("PROJECT: CELPIP Speaking");
    expect(block).toContain("Makes: Short-form video");
    expect(block).toContain("Audience: Newcomers to Canada");
    expect(block).toContain("Voice: Direct, warm");
    expect(block).toContain("Never: Never promise a guaranteed score.");
    expect(block).toContain(
      "- Question walkthroughs: One real task, answered live. (e.g. Task 5 in 60 seconds)",
    );
  });

  it("is byte-identical across calls so prompt caching can hit", () => {
    const p = project();
    const pillars = [pillar({ name: "The grind" })];
    expect(buildProjectContext(p, pillars)).toBe(
      buildProjectContext(p, pillars),
    );
  });

  it("omits fields the creator has not filled in", () => {
    const block = buildProjectContext(
      project({ voice: "", offers: "", doNots: "   " }),
      [],
    );
    expect(block).not.toContain("Voice:");
    expect(block).not.toContain("Offers:");
    expect(block).not.toContain("Never:");
    expect(block).toContain("Makes:");
  });

  it("returns an empty string when there is nothing to say", () => {
    expect(buildProjectContext(null, [])).toBe("");
    expect(
      buildProjectContext(
        project({
          name: "",
          whatIMake: "",
          audience: "",
          voice: "",
          offers: "",
          doNots: "",
        }),
        [],
      ),
    ).toBe("");
  });

  it("drops the project fields entirely on the pillars tier", () => {
    const block = buildProjectContext(
      project(),
      [pillar({ name: "Brain dumps" })],
      { tier: "pillars" },
    );
    expect(block).not.toContain("PROJECT:");
    expect(block).not.toContain("Audience:");
    expect(block).toContain("- Brain dumps");
  });

  it("truncates one rambling field instead of letting it crowd out pillars", () => {
    const block = buildProjectContext(
      project({ whatIMake: "word ".repeat(500) }),
      [pillar({ name: "Technical teaching" })],
    );
    expect(block).toContain("…");
    expect(block).toContain("- Technical teaching");
    // The rambling field is capped well below the whole-block ceiling.
    const makesLine = block
      .split("\n")
      .find((l) => l.startsWith("Makes:")) as string;
    expect(makesLine.length).toBeLessThan(340);
  });

  it("never ends a truncated field mid-word", () => {
    const word = "supercalifragilistic";
    const block = buildProjectContext(
      project({ audience: `${word} `.repeat(40) }),
      [],
    );
    const line = block
      .split("\n")
      .find((l) => l.startsWith("Audience:")) as string;

    expect(line.endsWith("…")).toBe(true);
    // Every word that survived is a whole one: a mid-word cut would leave a
    // final fragment like "supercalifragi" before the ellipsis.
    const words = line
      .replace(/^Audience:\s*/, "")
      .replace(/…$/, "")
      .trim()
      .split(" ");
    expect(words.every((w) => w === word)).toBe(true);
  });

  it("honours the global ceiling by dropping whole lines", () => {
    const pillars = Array.from({ length: 12 }, (_, i) =>
      pillar({
        name: `Pillar ${i}`,
        description: "A reasonably long description of this pillar's remit.",
      }),
    );
    const block = buildProjectContext(project(), pillars, { maxChars: 300 });
    expect(block.length).toBeLessThanOrEqual(300);
    // Whatever survived is still whole lines, not a half-cut one.
    for (const line of block.split("\n")) {
      expect(line.trim().length).toBeGreaterThan(0);
    }
  });

  it("caps the pillar list and the examples per pillar", () => {
    const pillars = Array.from({ length: 30 }, (_, i) =>
      pillar({ name: `Pillar ${i}`, examples: ["a", "b", "c", "d"] }),
    );
    const block = buildProjectContext(project(), pillars, {
      maxChars: 100_000,
    });
    const listed = block.split("\n").filter((l) => l.startsWith("- "));
    expect(listed).toHaveLength(12);
    expect(listed[0]).toBe("- Pillar 0 (e.g. a; b)");
  });

  it("skips pillars with a blank name", () => {
    const block = buildProjectContext(project(), [
      pillar({ name: "  " }),
      pillar({ name: "Real one" }),
    ]);
    const listed = block.split("\n").filter((l) => l.startsWith("- "));
    expect(listed).toEqual(["- Real one"]);
  });

  it("flattens newlines so a pasted essay cannot break the block's shape", () => {
    const block = buildProjectContext(
      project({ voice: "line one\nline two\n\nline three" }),
      [],
    );
    expect(block).toContain("Voice: line one line two line three");
  });
});

describe("projectContextSection", () => {
  it("is empty for an empty block, so prompts stay unchanged", () => {
    expect(projectContextSection("")).toBe("");
    expect(projectContextSection("   \n ")).toBe("");
  });

  it("wraps a real block with its framing, separated from what precedes it", () => {
    const section = projectContextSection("PROJECT: X");
    expect(section.startsWith("\n\n")).toBe(true);
    expect(section).toContain("ground truth");
    expect(section.endsWith("PROJECT: X")).toBe(true);
  });
});
