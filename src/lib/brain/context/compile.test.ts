import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ selectByModel: vi.fn() }));
vi.mock("./select-model", () => ({ selectByModel: mocks.selectByModel }));

import { SURFACE_BUDGETS } from "./budgets";
import { compileBrain } from "./compile";
import { clearSelectionCache, resetRouterBreaker } from "./select";
import type {
  BrainBlockSource,
  BrainSkillSource,
  BrainSnapshot,
} from "./types";

const block = (patch: Partial<BrainBlockSource>): BrainBlockSource => ({
  id: "b1",
  title: "Section",
  kind: "note",
  usage: "auto",
  digest: "",
  body: "body text",
  items: [],
  rows: null,
  tags: [],
  sourceLabel: "",
  ...patch,
});

const skill = (patch: Partial<BrainSkillSource>): BrainSkillSource => ({
  id: "s1",
  name: "Storytime",
  whenToUse: "the idea is a personal story",
  instructions: "Three acts, and the proportions matter.",
  surfaces: ["script"],
  enabled: true,
  ...patch,
});

const snapshot = (patch: Partial<BrainSnapshot> = {}): BrainSnapshot => ({
  project: {
    name: "CELPIP Speaking",
    whatIMake: "Short lessons",
    audience: "Newcomers sitting CELPIP",
    voice: "Direct",
    offers: "",
    doNots: "",
  },
  pillars: [{ name: "Speaking", description: "", examples: [] }],
  blocks: [],
  skills: [],
  ...patch,
});

const compile = (snap: BrainSnapshot, over: Record<string, unknown> = {}) =>
  compileBrain(snap, {
    surface: "script",
    task: "a personal story about pricing",
    projectId: "p1",
    contextVersion: 1,
    useModel: false,
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  clearSelectionCache();
  resetRouterBreaker();
});

describe("compileBrain", () => {
  it("returns an empty section for a brain with nothing in it", async () => {
    const compiled = await compile(
      snapshot({ project: null, pillars: [], blocks: [], skills: [] }),
    );
    expect(compiled.section).toBe("");
  });

  it("orders the section as core, then index, then loaded", async () => {
    // Six routable items, which is above the floor where selection kicks in.
    // Below it everything loads and there is nothing left to index.
    const compiled = await compile(
      snapshot({
        blocks: [
          block({ id: "b1", title: "Pricing objections", tags: ["pricing"] }),
          block({ id: "b2", title: "Lighting notes" }),
          block({ id: "b3", title: "Audience survey" }),
          block({ id: "b4", title: "Gear list" }),
        ],
        skills: [skill({}), skill({ id: "s2", name: "Retention beats" })],
      }),
    );
    const { section } = compiled;
    expect(section.indexOf("STANDING CONTEXT")).toBeLessThan(
      section.indexOf("ALSO IN THEIR BRAIN"),
    );
    expect(section.indexOf("ALSO IN THEIR BRAIN")).toBeLessThan(
      section.indexOf("LOADED FOR THIS TASK"),
    );
  });

  it("does not list a loaded section as one it has not read", async () => {
    const compiled = await compile(
      snapshot({
        blocks: [
          block({ id: "b1", title: "Pricing objections", tags: ["pricing"] }),
          block({ id: "b2", title: "Lighting notes" }),
          block({ id: "b3", title: "Audience survey" }),
          block({ id: "b4", title: "Gear list" }),
        ],
        skills: [skill({}), skill({ id: "s2", name: "Retention beats" })],
      }),
    );
    expect(compiled.used.context).toContain("Pricing objections");
    // Loaded in full below, so it is not also advertised as unread above.
    const indexLines = compiled.index.split("\n");
    expect(indexLines.some((line) => line.includes("Pricing objections"))).toBe(
      false,
    );
    expect(indexLines.some((line) => line.includes("Lighting notes"))).toBe(
      true,
    );
  });

  it("reports what it read, by name", async () => {
    const compiled = await compile(
      snapshot({
        blocks: [block({ id: "b1", title: "Pricing objections" })],
        skills: [skill({})],
      }),
    );
    expect(compiled.used).toEqual({
      skills: ["Storytime"],
      context: ["Pricing objections"],
    });
  });

  it("stays inside the surface budget with a huge imported table", async () => {
    const rows = Array.from({ length: 3_000 }, (_, index) => [
      `pricing keyword ${index}`,
      String(index),
    ]);
    const compiled = await compile(
      snapshot({
        blocks: [
          block({
            id: "b1",
            title: "Keyword research",
            kind: "table",
            digest: "pricing keywords from the export",
            rows: { columns: ["keyword", "volume"], rows },
          }),
        ],
        skills: [skill({})],
      }),
    );
    const budget = SURFACE_BUDGETS.script;
    expect(compiled.core.length).toBeLessThanOrEqual(budget.core);
    expect(compiled.loaded.length).toBeLessThanOrEqual(budget.loaded);
    // The whole point: a 3000 row export is still readable as a section.
    expect(compiled.loaded).toContain("keyword | volume");
    expect(compiled.loaded).toContain("more rows not shown");
  });

  it("loads nothing on the classification surface", async () => {
    const compiled = await compile(
      snapshot({
        blocks: [block({ id: "b1", title: "Pricing objections" })],
        skills: [skill({ surfaces: ["capture"] })],
      }),
      { surface: "capture" },
    );
    expect(compiled.loaded).toBe("");
    expect(compiled.index).toBe("");
    expect(compiled.section).toContain("PILLARS:");
    expect(compiled.section).not.toContain("Pricing objections");
  });

  it("keeps a private section out of every part of the prompt", async () => {
    const compiled = await compile(
      snapshot({
        blocks: [
          block({ id: "b1", title: "Therapy notes", usage: "private" }),
          block({ id: "b2", title: "Pricing objections" }),
        ],
      }),
    );
    expect(compiled.section).not.toContain("Therapy notes");
  });

  it("carries a core section in the core, not the index", async () => {
    const compiled = await compile(
      snapshot({
        blocks: [
          block({
            id: "b1",
            title: "Rules I keep",
            usage: "core",
            body: "Never open with a greeting.",
          }),
        ],
      }),
    );
    expect(compiled.core).toContain("RULES I KEEP:");
    expect(compiled.index).toBe("");
  });

  it("still compiles when the router fails", async () => {
    mocks.selectByModel.mockRejectedValue(new Error("router_timeout"));
    const compiled = await compile(
      snapshot({
        blocks: [
          block({ id: "b1", title: "Pricing objections", tags: ["pricing"] }),
          block({ id: "b2", title: "Lighting notes" }),
          block({ id: "b3", title: "Audience survey" }),
        ],
        skills: [skill({ id: "s1" }), skill({ id: "s2", name: "Retention" })],
      }),
      { useModel: true },
    );
    expect(compiled.selection.by).toBe("rules");
    expect(compiled.used.context).toContain("Pricing objections");
  });
});
