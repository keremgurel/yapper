import { describe, expect, it } from "vitest";
import { chunkDocument, CHUNK_THRESHOLD } from "./chunk";

const paragraph = (word: string, times: number) =>
  Array.from({ length: times }, () => word).join(" ");

describe("chunkDocument", () => {
  it("returns nothing for an empty document", () => {
    expect(chunkDocument("")).toEqual([]);
    expect(chunkDocument("   \n\n  ")).toEqual([]);
  });

  it("keeps a short document as a single chunk", () => {
    const chunks = chunkDocument("One short note about pricing.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ ord: 0, heading: "" });
    expect(chunks[0].charCount).toBe(chunks[0].text.length);
  });

  it("splits a long document and numbers the slices in order", () => {
    const body = Array.from({ length: 8 }, (_, index) =>
      paragraph(`para${index}`, 60),
    ).join("\n\n");
    expect(body.length).toBeGreaterThan(CHUNK_THRESHOLD);

    const chunks = chunkDocument(body);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.ord)).toEqual(
      chunks.map((_, index) => index),
    );
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThan(1_600);
  });

  it("carries the nearest markdown heading onto the slices under it", () => {
    const body = [
      "# Findings",
      paragraph("finding", 200),
      "# Method",
      paragraph("method", 200),
    ].join("\n\n");

    const chunks = chunkDocument(body);
    expect(chunks.some((chunk) => chunk.heading === "Findings")).toBe(true);
    expect(chunks.some((chunk) => chunk.heading === "Method")).toBe(true);
    // A heading starts a new slice rather than being buried mid-chunk.
    const findings = chunks.filter((chunk) => chunk.heading === "Findings");
    expect(findings.every((chunk) => !chunk.text.includes("method"))).toBe(
      true,
    );
  });

  it("treats a bare label line as a heading", () => {
    const body = ["Audience notes:", paragraph("note", 200)].join("\n\n");
    expect(
      chunkDocument(`${body}\n\n${paragraph("more", 200)}`)[0].heading,
    ).toBe("Audience notes");
  });

  it("splits a single unbroken paragraph on sentence ends", () => {
    const sentence = `${paragraph("word", 40)}. `;
    const chunks = chunkDocument(sentence.repeat(20));
    expect(chunks.length).toBeGreaterThan(1);
    // Nothing lost: every chunk carries real text.
    expect(chunks.every((chunk) => chunk.text.trim().length > 0)).toBe(true);
  });

  it("normalises carriage returns so a pasted Windows file chunks the same", () => {
    const unix = `# A\n\n${paragraph("x", 200)}\n\n# B\n\n${paragraph("y", 200)}`;
    expect(chunkDocument(unix.replace(/\n/g, "\r\n"))).toEqual(
      chunkDocument(unix),
    );
  });
});
