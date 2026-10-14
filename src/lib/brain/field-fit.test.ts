import { describe, expect, it } from "vitest";
import { charactersCut, fieldLength } from "./field-fit";

describe("fieldLength", () => {
  it("counts the way the compiler reads the field", () => {
    expect(fieldLength("  two   words \n")).toBe(9);
    expect(fieldLength("")).toBe(0);
  });

  it("reports only what runs past the limit", () => {
    expect(charactersCut("a".repeat(480), 480)).toBe(0);
    expect(charactersCut("a".repeat(500), 480)).toBe(20);
  });
});
