import { describe, expect, it } from "vitest";
import { buildIndex, entryFor } from "./digest";
import type { BrainBlockSource, BrainSkillSource } from "./types";

const block = (patch: Partial<BrainBlockSource>): BrainBlockSource => ({
  id: "b1",
  title: "Content gaps",
  kind: "note",
  usage: "auto",
  digest: "",
  body: "something",
  items: [],
  rows: null,
  tags: [],
  sourceLabel: "",
  ...patch,
});

const skill = (patch: Partial<BrainSkillSource>): BrainSkillSource => ({
  id: "s1",
  name: "Storytime, three acts",
  whenToUse: "The idea is a personal story",
  instructions: "Three acts.",
  surfaces: ["script"],
  enabled: true,
  ...patch,
});

describe("buildIndex", () => {
  it("is empty when the brain holds nothing routable", () => {
    expect(buildIndex([], [], 800)).toEqual({ entries: [], text: "" });
  });

  it("lists skills before sections, numbered from one", () => {
    const index = buildIndex([block({})], [skill({})], 800);
    expect(index.entries.map((entry) => entry.ref)).toEqual(["s1", "c1"]);
    expect(index.text.split("\n")[0]).toContain("[s1] Storytime, three acts");
  });

  it("describes a table by its shape when the creator wrote no digest", () => {
    const index = buildIndex(
      [
        block({
          kind: "table",
          rows: { columns: ["keyword", "volume"], rows: [["a", "1"]] },
        }),
      ],
      [],
      800,
    );
    expect(index.text).toContain("table, 1 row, 2 columns");
  });

  it("prefers the creator's own digest", () => {
    const index = buildIndex(
      [block({ digest: "use when picking a topic" })],
      [],
      800,
    );
    expect(index.text).toContain("use when picking a topic");
  });

  it("leaves out core, manual and private sections", () => {
    const index = buildIndex(
      [
        block({ id: "a", title: "Core", usage: "core" }),
        block({ id: "b", title: "Manual", usage: "manual" }),
        block({ id: "c", title: "Private", usage: "private" }),
        block({ id: "d", title: "Routable", usage: "auto" }),
      ],
      [],
      800,
    );
    expect(index.entries).toHaveLength(1);
    expect(index.text).toContain("Routable");
  });

  it("leaves out a disabled skill", () => {
    expect(buildIndex([], [skill({ enabled: false })], 800).entries).toEqual(
      [],
    );
  });

  it("drops whole entries rather than half a line when it will not fit", () => {
    const index = buildIndex(
      [
        block({ id: "a", title: "First section" }),
        block({ id: "b", title: "Second section" }),
        block({ id: "c", title: "Third section" }),
      ],
      [],
      45,
    );
    expect(index.text.length).toBeLessThanOrEqual(45);
    for (const line of index.text.split("\n")) {
      expect(line).toMatch(/^\[c\d\] .+ · note$/);
    }
    // Every rendered line is still resolvable back to an entry.
    for (const entry of index.entries) {
      expect(index.text).toContain(entry.line);
    }
  });

  it("resolves a ref, and refuses one the model invented", () => {
    const index = buildIndex([block({})], [], 800);
    expect(entryFor(index, "c1")?.id).toBe("b1");
    expect(entryFor(index, "c9")).toBeNull();
  });
});
