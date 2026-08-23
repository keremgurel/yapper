import { describe, expect, it } from "vitest";
import { describeBlock, excerptBlock } from "./excerpt";
import { tokenize } from "./text";
import type { BrainBlockSource } from "./types";

const block = (patch: Partial<BrainBlockSource>): BrainBlockSource => ({
  id: "b1",
  title: "Section",
  kind: "note",
  usage: "auto",
  digest: "",
  body: "",
  items: [],
  rows: null,
  tags: [],
  sourceLabel: "",
  ...patch,
});

describe("excerptBlock", () => {
  it("returns nothing when there is no room", () => {
    expect(excerptBlock(block({ body: "anything" }), new Set(), 0)).toBe("");
  });

  it("reads a list from the top when the task says nothing", () => {
    const source = block({
      kind: "list",
      items: ["first line", "second line", "third line"],
    });
    expect(excerptBlock(source, new Set(), 200)).toBe(
      "- first line\n- second line\n- third line",
    );
  });

  it("floats the matching lines of a list to the top", () => {
    const source = block({
      kind: "list",
      items: ["talk about lighting", "talk about pricing", "talk about audio"],
    });
    const first = excerptBlock(source, tokenize("pricing"), 200).split("\n")[0];
    expect(first).toBe("- talk about pricing");
  });

  it("says how many list lines it left out", () => {
    const source = block({
      kind: "list",
      items: Array.from({ length: 20 }, (_, i) => `line number ${i}`),
    });
    expect(excerptBlock(source, new Set(), 60)).toContain("more not shown");
  });

  it("keeps a table's header and only the rows the task is about", () => {
    const source = block({
      kind: "table",
      rows: {
        columns: ["keyword", "volume"],
        rows: [
          ["ielts speaking", "1200"],
          ["celpip pricing", "300"],
          ["accent reduction", "800"],
        ],
      },
    });
    const text = excerptBlock(source, tokenize("pricing for celpip"), 80);
    expect(text.split("\n")[0]).toBe("keyword | volume");
    expect(text).toContain("celpip pricing");
    expect(text).toContain("more rows not shown");
  });

  it("keeps the header even when neither a row nor the count fits", () => {
    const source = block({
      kind: "table",
      rows: { columns: ["keyword"], rows: [["a very long keyword phrase"]] },
    });
    expect(excerptBlock(source, new Set(), 12)).toBe("keyword");
  });

  it("spends a tight budget on a row rather than on the count", () => {
    const source = block({
      kind: "table",
      rows: {
        columns: ["keyword"],
        rows: [["celpip pricing"], ["ielts speaking"], ["accent work"]],
      },
    });
    const text = excerptBlock(source, tokenize("pricing"), 32);
    expect(text).toBe("keyword\ncelpip pricing");
  });

  it("picks the matching document chunks and restores document order", () => {
    const source = block({
      kind: "doc",
      body: "ignored when chunks exist",
      chunks: [
        { ord: 0, heading: "Intro", text: "about lighting kit" },
        { ord: 1, heading: "Pricing", text: "about pricing tiers" },
        { ord: 2, heading: "Outro", text: "about pricing objections" },
      ],
    });
    const text = excerptBlock(source, tokenize("pricing"), 80);
    expect(text.indexOf("Pricing:")).toBeLessThan(text.indexOf("Outro:"));
    expect(text).not.toContain("lighting");
  });

  it("falls back to the raw body for a document with no chunks", () => {
    const source = block({ kind: "doc", body: "raw pasted text" });
    expect(excerptBlock(source, new Set(), 100)).toBe("raw pasted text");
  });

  it("keeps the lines a creator typed into a prose block", () => {
    const source = block({ body: "The rule.", items: ["and a line"] });
    expect(excerptBlock(source, new Set(), 100)).toBe(
      "The rule.\n- and a line",
    );
  });
});

describe("describeBlock", () => {
  it("counts rows and columns for a table", () => {
    expect(
      describeBlock(
        block({
          kind: "table",
          rows: { columns: ["a", "b"], rows: [["1", "2"]] },
        }),
      ),
    ).toBe("table, 1 row, 2 columns");
  });

  it("counts lines for a list, and says note for prose", () => {
    expect(describeBlock(block({ kind: "list", items: ["x"] }))).toBe(
      "list, 1 line",
    );
    expect(describeBlock(block({}))).toBe("note");
  });
});
