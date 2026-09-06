import { describe, expect, it } from "vitest";
import { findKnowledge } from "./find-knowledge";

describe("Knowledge title resolution", () => {
  const blocks = [{ title: "Hooks" }, { title: "Hooks for launches" }];
  it("prefers a full title and permits unique partial matches", () => {
    expect(findKnowledge(blocks, " hooks ")).toBe(blocks[0]);
    expect(findKnowledge(blocks, "launches")).toBe(blocks[1]);
  });
  it("rejects ambiguous partial titles instead of changing the first match", () => {
    expect(() => findKnowledge(blocks, "hook")).toThrow("knowledge_ambiguous");
    expect(() =>
      findKnowledge([{ title: "Hooks" }, { title: "Hooks" }], "Hooks"),
    ).toThrow("knowledge_ambiguous");
  });
  it("does not interpret a missing or empty title as every block", () => {
    expect(findKnowledge(blocks, "")).toBeNull();
    expect(findKnowledge(blocks, "unknown")).toBeNull();
  });
});
