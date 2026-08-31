import { describe, expect, it } from "vitest";
import { parsePillarInput, parseProjectInput } from "@/lib/project/input";

describe("parseProjectInput", () => {
  it("keeps only the fields that were sent", () => {
    const input = parseProjectInput({ audience: "Newcomers", voice: "Direct" });
    expect(input).toEqual({ audience: "Newcomers", voice: "Direct" });
  });

  it("drops unknown keys and non-string values", () => {
    const input = parseProjectInput({
      whatIMake: "Videos",
      sneaky: "nope",
      contextVersion: 999,
      audience: 42,
    });
    expect(input).toEqual({ whatIMake: "Videos" });
  });

  it("preserves an explicit empty string so a field can be cleared", () => {
    expect(parseProjectInput({ voice: "" })).toEqual({ voice: "" });
  });

  it("clamps long fields", () => {
    const input = parseProjectInput({ audience: "x".repeat(5000) });
    expect(input.audience).toHaveLength(2000);
  });

  it("normalizes links and caps the list", () => {
    const input = parseProjectInput({
      links: ["  https://a.com  ", "", 5, "https://b.com"],
    });
    expect(input.links).toEqual(["https://a.com", "https://b.com"]);
  });

  it("normalizes, deduplicates, and validates brand colors", () => {
    const input = parseProjectInput({
      brandColors: [" #ff7a21 ", "#FF7A21", "#151515", "orange", 42],
    });
    expect(input.brandColors).toEqual(["#FF7A21", "#151515"]);
  });

  it("caps a brand palette at eight colors", () => {
    const brandColors = Array.from(
      { length: 12 },
      (_, index) => `#00000${index.toString(16)}`,
    );
    expect(parseProjectInput({ brandColors }).brandColors).toHaveLength(8);
  });
});

describe("parsePillarInput", () => {
  it("returns null when no array was sent, so pillars are left alone", () => {
    expect(parsePillarInput(undefined)).toBeNull();
    expect(parsePillarInput("nope")).toBeNull();
  });

  it("returns an empty array when the creator deleted every pillar", () => {
    expect(parsePillarInput([])).toEqual([]);
  });

  it("keeps ids so existing pillars are updated rather than recreated", () => {
    const parsed = parsePillarInput([
      { id: "abc", name: "The grind", description: "Sport and instrument." },
    ]);
    expect(parsed).toEqual([
      {
        id: "abc",
        name: "The grind",
        description: "Sport and instrument.",
        examples: [],
      },
    ]);
  });

  it("treats a missing id as a new pillar", () => {
    const parsed = parsePillarInput([{ name: "Brain dumps" }]);
    expect(parsed?.[0].id).toBeUndefined();
  });

  it("drops entries with no usable name instead of failing the save", () => {
    const parsed = parsePillarInput([
      { name: "  " },
      { description: "orphan" },
      null,
      "string",
      { name: "Real" },
    ]);
    expect(parsed?.map((p) => p.name)).toEqual(["Real"]);
  });

  it("drops case-insensitive duplicates that would violate the unique index", () => {
    const parsed = parsePillarInput([
      { name: "The Grind" },
      { name: "the grind" },
    ]);
    expect(parsed?.map((p) => p.name)).toEqual(["The Grind"]);
  });

  it("trims and caps examples", () => {
    const parsed = parsePillarInput([
      { name: "P", examples: ["  a  ", "", 3, "b", "c", "d", "e", "f"] },
    ]);
    expect(parsed?.[0].examples).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("caps the number of pillars", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}` }));
    expect(parsePillarInput(many)).toHaveLength(24);
  });
});
