import { describe, expect, it } from "vitest";
import { parseViewInput } from "@/lib/views/input";

describe("parseViewInput", () => {
  it("rejects a view with no name", () => {
    expect(parseViewInput({})).toBeNull();
    expect(parseViewInput({ name: "   " })).toBeNull();
  });

  it("defaults to a flat table", () => {
    expect(parseViewInput({ name: "Mine" })).toEqual({
      name: "Mine",
      kind: "table",
      groupBy: null,
      filters: {},
      columns: [],
    });
  });

  it("keeps a valid kind and grouping", () => {
    expect(
      parseViewInput({ name: "Board", kind: "board", groupBy: "status" }),
    ).toMatchObject({ kind: "board", groupBy: "status" });
  });

  it("falls back rather than storing an unknown kind or grouping", () => {
    expect(
      parseViewInput({ name: "x", kind: "gantt", groupBy: "vibes" }),
    ).toMatchObject({ kind: "table", groupBy: null });
  });

  /** A filter naming something this app does not have would match nothing,
   * which reads as a broken view rather than a missing value. */
  it("drops filter values outside the known vocabularies", () => {
    const view = parseViewInput({
      name: "x",
      filters: {
        status: ["drafted", "archived"],
        formats: ["short", "hologram"],
      },
    });
    expect(view?.filters).toEqual({ status: ["drafted"], formats: ["short"] });
  });

  it("omits a filter key entirely when nothing valid is left", () => {
    const view = parseViewInput({ name: "x", filters: { status: ["nope"] } });
    expect(view?.filters).toEqual({});
  });

  it("keeps pillar ids as given, since a stale one simply matches nothing", () => {
    const view = parseViewInput({
      name: "x",
      filters: { pillarId: ["some-uuid"] },
    });
    expect(view?.filters.pillarId).toEqual(["some-uuid"]);
  });

  it("drops unknown column keys and de-duplicates", () => {
    const view = parseViewInput({
      name: "x",
      columns: ["title", "title", "nonsense", "status"],
    });
    expect(view?.columns).toEqual(["title", "status"]);
  });

  it("clamps a very long name", () => {
    expect(parseViewInput({ name: "a".repeat(200) })?.name).toHaveLength(60);
  });
});
