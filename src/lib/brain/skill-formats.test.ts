import { describe, expect, it } from "vitest";
import { skillApplies, toggleSkillFormat } from "./skill-formats";

describe("skill formats", () => {
  it("shapes every format when none is picked", () => {
    expect(skillApplies([], "article")).toBe(true);
    expect(skillApplies(undefined, "long")).toBe(true);
    expect(skillApplies(["short"], "long")).toBe(false);
  });

  it("toggles a format and keeps tab order", () => {
    expect(toggleSkillFormat(["article"], "short")).toEqual([
      "short",
      "article",
    ]);
    expect(toggleSkillFormat(["short", "article"], "short")).toEqual([
      "article",
    ]);
  });
});
