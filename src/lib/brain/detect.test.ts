import { describe, expect, it } from "vitest";
import { detectPaste, splitDelimited } from "./detect";

describe("splitDelimited", () => {
  it("keeps a delimiter that sits inside quotes", () => {
    expect(splitDelimited('a,"b,c",d', ",")).toEqual(["a", "b,c", "d"]);
  });

  it("unescapes a doubled quote", () => {
    expect(splitDelimited('"say ""hi""",b', ",")).toEqual(['say "hi"', "b"]);
  });
});

describe("detectPaste", () => {
  it("reads a CSV export as a table with its header row", () => {
    const detected = detectPaste(
      "keyword,volume\nielts speaking,1200\ncelpip pricing,300",
    );
    expect(detected.kind).toBe("table");
    expect(detected.rows).toEqual({
      columns: ["keyword", "volume"],
      rows: [
        ["ielts speaking", "1200"],
        ["celpip pricing", "300"],
      ],
    });
    expect(detected.size.rows).toBe(2);
  });

  it("reads a TSV export the same way", () => {
    const detected = detectPaste("a\tb\n1\t2\n3\t4");
    expect(detected.kind).toBe("table");
    expect(detected.rows?.columns).toEqual(["a", "b"]);
  });

  it("invents column names when the first row is data, not headers", () => {
    const detected = detectPaste("1,2\n3,4\n5,6");
    expect(detected.rows?.columns).toEqual(["Column 1", "Column 2"]);
    expect(detected.rows?.rows).toHaveLength(3);
  });

  it("does not mistake prose with commas for a table", () => {
    const prose =
      "I make short videos, mostly about speaking.\n" +
      "The audience is newcomers, and they are busy.\n" +
      "Nothing here is a spreadsheet, obviously.";
    expect(detectPaste(prose).kind).toBe("note");
  });

  it("drops a ragged row rather than shifting the columns", () => {
    const detected = detectPaste(
      "a,b,c\n1,2,3\n4,5,6\n7,8,9\n10,11,12\nbroken,row\n13,14,15",
    );
    expect(detected.rows?.rows.every((row) => row.length === 3)).toBe(true);
    expect(detected.rows?.rows).toHaveLength(5);
  });

  it("reads an array of objects as a table over the union of its keys", () => {
    const detected = detectPaste(
      JSON.stringify([
        { term: "a", volume: 1 },
        { term: "b", gap: true },
      ]),
    );
    expect(detected.kind).toBe("table");
    expect(detected.rows?.columns).toEqual(["term", "volume", "gap"]);
    expect(detected.rows?.rows[1]).toEqual(["b", "", "true"]);
  });

  it("reads a bulleted paste as a list, without the bullets", () => {
    const detected = detectPaste("- first\n- second\n* third\n4. fourth");
    expect(detected.kind).toBe("list");
    expect(detected.items).toEqual(["first", "second", "third", "fourth"]);
  });

  it("calls a long unstructured paste a document", () => {
    const detected = detectPaste("sentence about things. ".repeat(120));
    expect(detected.kind).toBe("doc");
    expect(detected.body.length).toBeGreaterThan(1_500);
  });

  it("only ever samples a slice of a huge import", () => {
    const rows = Array.from(
      { length: 4_000 },
      (_, index) => `keyword ${index},${index}`,
    ).join("\n");
    const detected = detectPaste(`keyword,volume\n${rows}`);
    expect(detected.rows?.rows).toHaveLength(4_000);
    expect(detected.sample.length).toBeLessThanOrEqual(2_000);
    expect(detected.sample).toContain("and 3980 more rows");
  });

  it("samples both ends of a long document", () => {
    const body = `${"start ".repeat(400)}\n${"finish ".repeat(400)}`;
    const detected = detectPaste(body);
    expect(detected.sample).toContain("start");
    expect(detected.sample).toContain("finish");
    expect(detected.sample.length).toBeLessThanOrEqual(2_010);
  });

  it("gives an empty paste something harmless", () => {
    expect(detectPaste("")).toMatchObject({ kind: "note", body: "" });
  });
});
