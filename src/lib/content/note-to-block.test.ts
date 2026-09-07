import { describe, expect, it } from "vitest";
import { labelFor, noteToBlock } from "@/lib/content/note-to-block";

describe("noteToBlock", () => {
  it("turns a bulleted answer into a bullets block named after the question", () => {
    const block = noteToBlock(
      "- Speak slower\n- Name the score\n- End on the app",
      "What are the key points here?",
    );
    expect(block).toEqual({
      label: "Key points here",
      kind: "bullets",
      items: ["Speak slower", "Name the score", "End on the app"],
    });
  });

  it("keeps numbered lines as steps", () => {
    const block = noteToBlock(
      "1. Open cold\n2. Show the number\n3. Ask",
      "steps",
    );
    expect(block.kind).toBe("steps");
    expect(block.items).toHaveLength(3);
  });

  it("keeps prose as a paragraph", () => {
    const block = noteToBlock(
      "It works because the stakes are named first.",
      "Why does this hook work?",
    );
    expect(block).toEqual({
      label: "Why does this hook work",
      kind: "paragraph",
      text: "It works because the stakes are named first.",
    });
  });

  it("makes a heading out of a question", () => {
    expect(labelFor("give me some objections people will have")).toBe(
      "Objections people will have",
    );
    expect(labelFor("?")).toBe("Notes");
    expect(
      labelFor(
        "what is the single most important idea in this whole script really",
      ),
    ).toBe("Single most important idea in this");
  });
});
