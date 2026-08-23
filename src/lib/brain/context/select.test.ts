import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ selectByModel: vi.fn() }));
vi.mock("./select-model", () => ({ selectByModel: mocks.selectByModel }));

import { buildIndex } from "./digest";
import {
  clearSelectionCache,
  resetRouterBreaker,
  selectContext,
  type SelectOptions,
} from "./select";
import type { BrainBlockSource, BrainSkillSource } from "./types";

const block = (id: string, title: string): BrainBlockSource => ({
  id,
  title,
  kind: "note",
  usage: "auto",
  digest: "",
  body: "body",
  items: [],
  rows: null,
  tags: [],
  sourceLabel: "",
});

const skill = (id: string, name: string): BrainSkillSource => ({
  id,
  name,
  whenToUse: "",
  instructions: "do it",
  surfaces: ["script"],
  enabled: true,
});

/** Six routable items, which is above the floor where selection kicks in. */
function options(overrides: Partial<SelectOptions> = {}): SelectOptions {
  const blocks = [
    block("b1", "Lighting notes"),
    block("b2", "Pricing objections"),
    block("b3", "Audience survey"),
  ];
  const skills = [
    skill("s1", "Storytime"),
    skill("s2", "Retention beats"),
    skill("s3", "Show it"),
  ];
  return {
    projectId: "p1",
    contextVersion: 1,
    index: buildIndex(blocks, skills, 4000),
    blocks: new Map(blocks.map((b) => [b.id, b])),
    skills: new Map(skills.map((s) => [s.id, s])),
    surface: "script",
    task: "how I handle pricing objections",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  clearSelectionCache();
  resetRouterBreaker();
});

describe("selectContext", () => {
  it("loads everything without routing when the brain is small", async () => {
    const blocks = [block("b1", "One"), block("b2", "Two")];
    const selection = await selectContext(
      options({
        index: buildIndex(blocks, [], 4000),
        blocks: new Map(blocks.map((b) => [b.id, b])),
        skills: new Map(),
      }),
    );
    expect(selection.by).toBe("all");
    expect(mocks.selectByModel).not.toHaveBeenCalled();
  });

  it("returns nothing at all for an empty index", async () => {
    const selection = await selectContext(
      options({
        index: { entries: [], text: "" },
        blocks: new Map(),
        skills: new Map(),
      }),
    );
    expect(selection).toMatchObject({ skillRefs: [], contextRefs: [] });
    expect(mocks.selectByModel).not.toHaveBeenCalled();
  });

  it("uses the router's answer when it comes back", async () => {
    mocks.selectByModel.mockResolvedValue({
      skillRefs: ["s1"],
      contextRefs: ["c3"],
      by: "model",
    });
    const selection = await selectContext(options());
    expect(selection).toMatchObject({
      skillRefs: ["s1"],
      contextRefs: ["c3"],
      by: "model",
    });
  });

  it("falls back to the rules when the router throws", async () => {
    mocks.selectByModel.mockRejectedValue(new Error("router_timeout"));
    const selection = await selectContext(options());
    expect(selection.by).toBe("rules");
    // The generation still gets the section the task is obviously about.
    expect(selection.contextRefs).toContain("c2");
  });

  it("skips the router entirely when told not to use it", async () => {
    const selection = await selectContext(options({ useModel: false }));
    expect(selection.by).toBe("rules");
    expect(mocks.selectByModel).not.toHaveBeenCalled();
  });

  it("falls back to the rules when the creator is out of routing budget", async () => {
    const selection = await selectContext(
      options({ allow: async () => false }),
    );
    expect(selection.by).toBe("rules");
    expect(mocks.selectByModel).not.toHaveBeenCalled();
  });

  it("routes once for a repeated task", async () => {
    mocks.selectByModel.mockResolvedValue({
      skillRefs: ["s1"],
      contextRefs: [],
      by: "model",
    });
    await selectContext(options());
    await selectContext(options());
    expect(mocks.selectByModel).toHaveBeenCalledTimes(1);
  });

  it("routes again once the brain has changed", async () => {
    mocks.selectByModel.mockResolvedValue({
      skillRefs: [],
      contextRefs: [],
      by: "model",
    });
    await selectContext(options());
    await selectContext(options({ contextVersion: 2 }));
    expect(mocks.selectByModel).toHaveBeenCalledTimes(2);
  });

  it("stops calling a failing router after a run of failures", async () => {
    mocks.selectByModel.mockRejectedValue(new Error("router_502"));
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await selectContext(options({ task: `attempt ${attempt}` }));
    }
    expect(mocks.selectByModel).toHaveBeenCalledTimes(3);

    const selection = await selectContext(options({ task: "after the trip" }));
    expect(selection.by).toBe("rules");
    // The breaker is open, so the fourth call never reached the provider.
    expect(mocks.selectByModel).toHaveBeenCalledTimes(3);
  });

  it("clears the breaker after a success", async () => {
    mocks.selectByModel.mockRejectedValueOnce(new Error("router_502"));
    await selectContext(options({ task: "one" }));
    mocks.selectByModel.mockResolvedValue({
      skillRefs: [],
      contextRefs: [],
      by: "model",
    });
    await selectContext(options({ task: "two" }));

    mocks.selectByModel.mockRejectedValue(new Error("router_502"));
    for (const task of ["three", "four"]) {
      await selectContext(options({ task }));
    }
    // Two failures since the success is still under the threshold, so the next
    // call is allowed through rather than short-circuited.
    await selectContext(options({ task: "five" }));
    expect(mocks.selectByModel).toHaveBeenCalledTimes(5);
  });
});
