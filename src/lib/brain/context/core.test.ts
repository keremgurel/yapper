import { describe, expect, it } from "vitest";
import { buildCore, MAX_CORE_BLOCKS } from "./core";
import type {
  BrainBlockSource,
  BrainPillarSource,
  BrainProjectSource,
} from "./types";

const project: BrainProjectSource = {
  name: "CELPIP Speaking",
  whatIMake: "Short lessons for test takers",
  audience: "Newcomers to Canada sitting CELPIP",
  voice: "Direct, warm, no jargon",
  offers: "A 30 day speaking course",
  doNots: "Never promise a score",
};

const pillar = (name: string): BrainPillarSource => ({
  name,
  description: `${name} description`,
  examples: [`${name} example`],
});

const block = (patch: Partial<BrainBlockSource>): BrainBlockSource => ({
  id: "b1",
  title: "Rules I keep",
  kind: "note",
  usage: "core",
  digest: "",
  body: "Never open with a greeting.",
  items: [],
  rows: null,
  tags: [],
  sourceLabel: "",
  ...patch,
});

describe("buildCore", () => {
  it("returns nothing when there is nothing to say", () => {
    expect(buildCore(null, [], [], { maxChars: 1400 })).toBe("");
  });

  it("puts the project first, then pillars, then core sections", () => {
    const core = buildCore(project, [pillar("Speaking")], [block({})], {
      maxChars: 1400,
    });
    expect(core.indexOf("PROJECT:")).toBe(0);
    expect(core.indexOf("PILLARS:")).toBeGreaterThan(core.indexOf("Audience:"));
    expect(core.indexOf("RULES I KEEP:")).toBeGreaterThan(
      core.indexOf("PILLARS:"),
    );
  });

  it("is byte-stable across repeated calls, so the prompt prefix caches", () => {
    const once = buildCore(project, [pillar("Speaking")], [block({})], {
      maxChars: 1400,
    });
    const twice = buildCore(project, [pillar("Speaking")], [block({})], {
      maxChars: 1400,
    });
    expect(once).toBe(twice);
  });

  it("drops the classification tier down to pillars only", () => {
    const core = buildCore(project, [pillar("Speaking")], [block({})], {
      maxChars: 600,
      includeProject: false,
    });
    expect(core).not.toContain("PROJECT:");
    expect(core).not.toContain("RULES I KEEP:");
    expect(core.startsWith("PILLARS:")).toBe(true);
  });

  it("drops sections before it drops who the audience is", () => {
    const core = buildCore(
      project,
      [pillar("Speaking")],
      [block({ body: "x".repeat(400) })],
      { maxChars: 320 },
    );
    expect(core).toContain("Audience:");
    expect(core).not.toContain("RULES I KEEP:");
  });

  it("reads at most four core sections", () => {
    const blocks = Array.from({ length: 8 }, (_, index) =>
      block({ id: `b${index}`, title: `Rule ${index}` }),
    );
    const core = buildCore(null, [], blocks, { maxChars: 4000 });
    const seen = core.match(/RULE \d:/g) ?? [];
    expect(seen).toHaveLength(MAX_CORE_BLOCKS);
  });

  it("skips a core section with a title but no content", () => {
    const core = buildCore(null, [], [block({ body: "", items: [] })], {
      maxChars: 1400,
    });
    expect(core).toBe("");
  });

  it("truncates a rambling field rather than letting it crowd out the rest", () => {
    const core = buildCore(
      { ...project, whatIMake: "y".repeat(2000) },
      [pillar("Speaking")],
      [],
      { maxChars: 1400 },
    );
    expect(core).toContain("Audience:");
    expect(core).toContain("PILLARS:");
    expect(core.length).toBeLessThanOrEqual(1400);
  });
});
