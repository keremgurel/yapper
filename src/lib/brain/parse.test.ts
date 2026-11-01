import { describe, expect, it } from "vitest";
import { parseSpunIdea } from "@/lib/brain/spin";
import {
  parseBlockOrder,
  parseBrainBlockInput,
  parseNewBrainBlock,
} from "@/lib/brain/input";

const combination = {
  pillar: "CELPIP tips",
  angle: "a mistake you made",
  format: "talking head",
};

describe("parseSpunIdea", () => {
  it("reads an idea out of a fenced reply", () => {
    const idea = parseSpunIdea(
      'Here you go:\n```json\n{"title":"The pause that costs you points","angle":"why","hook":"Stop saying um","pillar":"celpip tips"}\n```',
      combination,
      ["CELPIP tips"],
    );
    expect(idea.title).toBe("The pause that costs you points");
    expect(idea.hook).toBe("Stop saying um");
    // Snapped back to the creator's own casing, so the bank files it under a
    // pillar that already exists rather than a near-duplicate.
    expect(idea.pillar).toBe("CELPIP tips");
  });

  it("falls back to the dealt pillar when the model names none", () => {
    const idea = parseSpunIdea('{"title":"Something"}', combination, []);
    expect(idea.pillar).toBe("CELPIP tips");
  });

  it("refuses an idea with no title", () => {
    expect(() => parseSpunIdea('{"angle":"nice"}', combination, [])).toThrow();
    expect(() => parseSpunIdea("not json at all", combination, [])).toThrow();
  });
});

describe("parseBrainBlockInput", () => {
  it("leaves absent keys absent, so a partial save cannot blank a block", () => {
    const input = parseBrainBlockInput({ body: "why I post" });
    expect(input).toEqual({ body: "why I post" });
    expect("title" in input).toBe(false);
    expect("items" in input).toBe(false);
  });

  it("drops non-strings and blank lines from a list", () => {
    const input = parseBrainBlockInput({ items: ["one", "", 4, "  two  "] });
    expect(input.items).toEqual(["one", "two"]);
  });

  it("rejects an unknown kind rather than storing it", () => {
    expect(parseBrainBlockInput({ kind: "kanban" }).kind).toBeUndefined();
    expect(parseBrainBlockInput({ kind: "list" }).kind).toBe("list");
  });

  it("needs a title to create", () => {
    expect(parseNewBrainBlock({ body: "orphan" })).toBeNull();
    expect(parseNewBrainBlock({ title: "  Why I post  " })?.title).toBe(
      "Why I post",
    );
  });
});

describe("parseBlockOrder", () => {
  it("takes a list of ids and nothing else", () => {
    expect(parseBlockOrder(["a", 2, "b"])).toEqual(["a", "b"]);
    expect(parseBlockOrder([])).toBeNull();
    expect(parseBlockOrder("a,b")).toBeNull();
  });
});
