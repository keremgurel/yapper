import { describe, expect, it } from "vitest";
import { buildIndex } from "./digest";
import { selectAll, selectByRules } from "./select-rules";
import type { BrainBlockSource, BrainSkillSource } from "./types";

const block = (patch: Partial<BrainBlockSource>): BrainBlockSource => ({
  id: "b1",
  title: "Section",
  kind: "note",
  usage: "auto",
  digest: "",
  body: "body",
  items: [],
  rows: null,
  tags: [],
  sourceLabel: "",
  ...patch,
});

const skill = (patch: Partial<BrainSkillSource>): BrainSkillSource => ({
  id: "s1",
  name: "Skill",
  whenToUse: "",
  instructions: "do the thing",
  surfaces: [],
  enabled: true,
  ...patch,
});

function harness(blocks: BrainBlockSource[], skills: BrainSkillSource[]) {
  return {
    index: buildIndex(blocks, skills, 4000),
    blocks: new Map(blocks.map((b) => [b.id, b])),
    skills: new Map(skills.map((s) => [s.id, s])),
  };
}

describe("selectByRules", () => {
  it("ignores a skill that does not apply to this surface", () => {
    const input = harness(
      [],
      [skill({ id: "s1", name: "Caption rules", surfaces: ["caption"] })],
    );
    expect(
      selectByRules({ ...input, surface: "script", task: "caption rules" })
        .skillRefs,
    ).toEqual([]);
  });

  it("loads a skill that declares this surface even with no word match", () => {
    const input = harness(
      [],
      [skill({ id: "s1", name: "Retention beats", surfaces: ["script"] })],
    );
    expect(
      selectByRules({ ...input, surface: "script", task: "pricing tiers" })
        .skillRefs,
    ).toEqual(["s1"]);
  });

  it("ranks a matching skill above one that merely declares the surface", () => {
    const input = harness(
      [],
      [
        skill({ id: "s1", name: "Retention beats", surfaces: ["script"] }),
        skill({
          id: "s2",
          name: "Storytime",
          whenToUse: "the idea is a personal story",
          surfaces: ["script"],
        }),
      ],
    );
    const selection = selectByRules({
      ...input,
      surface: "script",
      task: "a personal story about my first client",
    });
    expect(selection.skillRefs[0]).toBe("s2");
  });

  it("loads the sections the task is about, best match first", () => {
    const input = harness(
      [
        block({ id: "b1", title: "Lighting notes" }),
        block({ id: "b2", title: "Pricing objections", tags: ["pricing"] }),
      ],
      [],
    );
    const selection = selectByRules({
      ...input,
      surface: "script",
      task: "how I handle pricing objections",
    });
    expect(selection.contextRefs).toEqual(["c2"]);
  });

  it("loads nothing when the task matches nothing", () => {
    const input = harness(
      [block({ id: "b1", title: "Lighting notes" })],
      [skill({ id: "s1", name: "Caption rules", surfaces: ["caption"] })],
    );
    const selection = selectByRules({
      ...input,
      surface: "script",
      task: "quarterly revenue forecast",
    });
    expect(selection).toMatchObject({ skillRefs: [], contextRefs: [] });
  });

  it("reads the top of the brain when there is no task text at all", () => {
    const input = harness(
      [
        block({ id: "b1", title: "First" }),
        block({ id: "b2", title: "Second" }),
        block({ id: "b3", title: "Third" }),
      ],
      [],
    );
    expect(
      selectByRules({ ...input, surface: "script", task: "" }).contextRefs,
    ).toEqual(["c1", "c2"]);
  });

  it("never loads more than three skills", () => {
    const skills = Array.from({ length: 6 }, (_, index) =>
      skill({
        id: `s${index}`,
        name: `Story skill ${index}`,
        surfaces: ["script"],
      }),
    );
    const input = harness([], skills);
    expect(
      selectByRules({ ...input, surface: "script", task: "story" }).skillRefs
        .length,
    ).toBeLessThanOrEqual(3);
  });

  it("marks how the choice was made", () => {
    const input = harness([block({})], []);
    expect(selectByRules({ ...input, surface: "script", task: "x" }).by).toBe(
      "rules",
    );
  });
});

describe("selectAll", () => {
  it("takes everything routable", () => {
    const input = harness([block({ id: "b1" })], [skill({ id: "s1" })]);
    expect(selectAll(input.index)).toEqual({
      skillRefs: ["s1"],
      contextRefs: ["c1"],
      by: "all",
    });
  });
});
