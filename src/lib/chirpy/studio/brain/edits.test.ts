import { describe, expect, it } from "vitest";
import type { BrainBlockRow } from "@/lib/db/project-brain";
import { StudioActionFailure } from "../executor";
import { knowledgePatch } from "./knowledge";
import { movedTo } from "./labels";
import { latestPaste } from "./paste";

const ID = "11111111-1111-4111-8111-111111111111";

/** The sentence a refused edit gives the creator. */
function refusal(edit: () => unknown): string {
  try {
    edit();
  } catch (error) {
    if (error instanceof StudioActionFailure) return error.sentence;
    throw error;
  }
  throw new Error("expected a refusal");
}

function stored(fields: Partial<BrainBlockRow> = {}): BrainBlockRow {
  return {
    id: ID,
    title: "Hook bank",
    kind: "note",
    body: "Open on the mistake. Never start with hello.",
    items: [],
    ...fields,
  } as BrainBlockRow;
}

describe("knowledgePatch", () => {
  it("swaps one passage, in the body or in a line", () => {
    expect(
      knowledgePatch(stored(), {
        blockID: ID,
        find: "Never start with hello.",
        replaceWith: "Never start with a greeting.",
      }),
    ).toEqual({ body: "Open on the mistake. Never start with a greeting." });
    expect(
      knowledgePatch(
        stored({ body: "", items: ["Rent is theft", "Save 10%"] }),
        {
          blockID: ID,
          find: "10%",
          replaceWith: "20%",
        },
      ),
    ).toEqual({ items: ["Rent is theft", "Save 20%"] });
  });

  it("refuses a passage that is missing or appears twice", () => {
    expect(() =>
      knowledgePatch(stored(), {
        blockID: ID,
        find: "goodbye",
        replaceWith: "",
      }),
    ).toThrow(StudioActionFailure);
    expect(
      refusal(() =>
        knowledgePatch(stored({ body: "one two one" }), {
          blockID: ID,
          find: "one",
          replaceWith: "three",
        }),
      ),
    ).toMatch(/more than once/);
  });

  it("appends instead of replacing when asked", () => {
    expect(
      knowledgePatch(stored(), {
        blockID: ID,
        body: "Cut the intro.",
        append: true,
      }),
    ).toEqual({
      body: "Open on the mistake. Never start with hello.\n\nCut the intro.",
    });
    expect(
      knowledgePatch(stored({ kind: "list", items: ["a"] }), {
        blockID: ID,
        items: ["b"],
        append: true,
      }),
    ).toEqual({ items: ["a", "b"] });
  });

  it("never rewrites an imported document whole", () => {
    expect(
      refusal(() =>
        knowledgePatch(stored({ kind: "doc" }), { blockID: ID, body: "short" }),
      ),
    ).toMatch(/won’t rewrite it whole/);
    expect(
      knowledgePatch(stored({ kind: "doc" }), {
        blockID: ID,
        body: "More.",
        append: true,
      }),
    ).toHaveProperty("body");
  });
});

describe("movedTo", () => {
  it("moves an id to a 1-based position, clamped to the list", () => {
    expect(movedTo(["a", "b", "c"], "c", 1)).toEqual(["c", "a", "b"]);
    expect(movedTo(["a", "b", "c"], "a", 2)).toEqual(["b", "a", "c"]);
    expect(movedTo(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
  });
});

describe("latestPaste", () => {
  it("reads the newest long message and drops a request line before it", () => {
    const csv = "keyword,volume\nrent hack,100\nbudget app,90";
    expect(
      latestPaste(
        [
          { role: "user", content: `File this in my brain:\n${csv}` },
          { role: "assistant", content: "x".repeat(400) },
          { role: "user", content: "yes" },
        ],
        20,
      ),
    ).toBe(csv);
    expect(latestPaste([{ role: "user", content: "short" }], 20)).toBeNull();
    expect(latestPaste(undefined, 20)).toBeNull();
  });
});
