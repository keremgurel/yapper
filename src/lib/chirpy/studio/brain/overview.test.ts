import { describe, expect, it } from "vitest";
import type { BrainBlockSource } from "@/lib/brain/context/types";
import { buildBrainOverview, type BrainOverviewSource } from "./overview";
import { needsBrain } from "./reads";

function block(index: number, fields: Partial<BrainBlockSource> = {}) {
  return {
    id: `0000000${index}`.slice(-8) + "-0000-4000-8000-000000000000",
    title: `Section ${index}`,
    kind: "note",
    usage: "auto",
    digest: "",
    body: "Plain notes. ".repeat(60),
    items: [],
    rows: null,
    tags: [],
    sourceLabel: "",
    ...fields,
  } as BrainBlockSource;
}

function source(blocks: BrainBlockSource[]): BrainOverviewSource {
  const long =
    "A creator who explains money to people in their twenties. ".repeat(30);
  return {
    project: {
      name: "Money Mondays",
      whatIMake: long,
      audience: long,
      voice: long,
      scriptingPatterns: long,
      offers: long,
      doNots: long,
      defaultFormat: "short",
      contextVersion: 9,
    },
    snapshot: {
      project: null,
      pillars: [
        { name: "Budgeting", description: long, examples: [] },
        { name: "Investing", description: "", examples: [] },
      ],
      blocks,
      skills: Array.from({ length: 9 }, (_, index) => ({
        id: `skill-${index}`,
        slug: index < 7 ? `starter-${index}` : null,
        name: `Skill ${index}`,
        whenToUse: "",
        instructions: "Write well. ".repeat(200),
        surfaces: [],
        enabled: index !== 2,
      })),
    },
    samples: [{ id: "sample-1", title: "My first video", platform: "youtube" }],
    sampleCount: 9,
    connected: ["youtube"],
  };
}

describe("buildBrainOverview", () => {
  const blocks = Array.from({ length: 40 }, (_, index) => block(index));
  blocks[31] = block(31, {
    title: "Hook bank",
    digest: "Openers that held attention, use when writing hooks",
    kind: "list",
    items: Array.from({ length: 300 }, (_, i) => `Hook line ${i} about rent`),
  });
  blocks[35] = block(35, {
    title: "Keyword research",
    kind: "table",
    usage: "manual",
    rows: {
      columns: ["keyword", "volume"],
      rows: Array.from({ length: 5000 }, (_, i) => [`rent hack ${i}`, "100"]),
    },
  });

  it("stays under 2k tokens however much the Brain holds", () => {
    const overview = buildBrainOverview(
      source(blocks),
      "what hooks do I have about rent?",
    );
    // Haiku 5.5 counted 1,882 tokens for this 3.9 KB (2026-10-31).
    expect(JSON.stringify(overview).length).toBeLessThan(4_200);
    expect(overview.knowledge.length).toBe(10);
    expect(overview.moreKnowledge).toBe(30);
    // "hooks" is about how scripts are built, so that field is shown longer.
    const { scriptingPatterns, ...rest } = overview.essentials;
    expect(scriptingPatterns.length).toBeGreaterThan(300);
    for (const value of Object.values(rest))
      expect(value.length).toBeLessThanOrEqual(101);
  });

  it("shows a field the request asks about at nearly full length", () => {
    const overview = buildBrainOverview(source(blocks), "who is my audience?");
    expect(overview.essentials.audience.length).toBeGreaterThan(300);
    expect(overview.essentials.voice.length).toBeLessThanOrEqual(101);
  });

  it("lists the matching sections in the creator's order and quotes them", () => {
    const overview = buildBrainOverview(
      source(blocks),
      "what hooks do I have about rent?",
    );
    const hookBank = overview.knowledge.find(
      (line) => line.title === "Hook bank",
    );
    expect(hookBank).toMatchObject({ kind: "list", position: 32 });
    const positions = overview.knowledge.map((line) => line.position!);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(overview.read?.[0].id).toBe(hookBank!.id);
    expect(overview.read?.[0].text).toContain("rent");
    expect(
      overview.read!.reduce((total, item) => total + item.text.length, 0),
    ).toBeLessThanOrEqual(710);
  });

  it("leaves out what is default, and quotes nothing for an unrelated request", () => {
    const overview = buildBrainOverview(source(blocks.slice(0, 3)), "hi");
    expect(overview.knowledge[0]).toEqual({
      id: blocks[0].id,
      title: "Section 0",
      digest: "note",
    });
    expect(overview.moreKnowledge).toBeUndefined();
    expect(overview.read).toBeUndefined();
    expect(overview.skills[2]).toEqual({
      id: "skill-2",
      name: "Skill 2",
      off: true,
    });
    expect(overview.skills[0]).not.toHaveProperty("off");
    expect(overview.voice).toEqual({
      samples: [
        { id: "sample-1", title: "My first video", platform: "youtube" },
      ],
      moreSamples: 8,
      connected: ["youtube"],
    });
    expect(overview.pillarNotes).toHaveProperty("Budgeting");
    expect(overview.pillarNotes).not.toHaveProperty("Investing");
  });

  it("marks installed catalog entries when the catalog is read", () => {
    const overview = buildBrainOverview(
      {
        ...source([]),
        catalog: [
          { slug: "starter-1", name: "Starter", kind: "skill" },
          { slug: "audience-worksheet", name: "Audience", kind: "context" },
        ],
      },
      "install a skill",
    );
    expect(overview.catalog).toEqual([
      { slug: "starter-1", name: "Starter", kind: "skill", installed: true },
      { slug: "audience-worksheet", name: "Audience", kind: "context" },
    ]);
  });
});

describe("needsBrain", () => {
  it("reads the Brain on its tab and for requests about it", () => {
    expect(needsBrain("/studio/brain", "hello")).toBe(true);
    expect(needsBrain("/studio/ideas", "who is my audience?")).toBe(true);
    expect(needsBrain("/studio/home", "remember that I film on Tuesdays")).toBe(
      true,
    );
    expect(needsBrain("/studio/ideas", "move gym myths to Friday")).toBe(false);
  });
});
