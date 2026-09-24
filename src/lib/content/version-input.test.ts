import { describe, expect, it } from "vitest";
import { parseVersionInput } from "./version-input";
import { parseSkillFormats } from "@/lib/brain/skill-input";
import { parseIdeaFields } from "@/lib/ideas/input";
import { parseProjectInput } from "@/lib/project/input";

describe("parseVersionInput", () => {
  it("keeps what was sent and drops the rest", () => {
    expect(
      parseVersionInput({
        title: "Why logic doesn't sell",
        script: "Chapter one",
        writtenFrom: "short",
        leadFormat: "long",
        hooks: ["An opener"],
      }),
    ).toEqual({
      title: "Why logic doesn't sell",
      script: "Chapter one",
      writtenFrom: "short",
      hooks: [{ text: "An opener", pattern: null, why: null }],
    });
  });

  it("allows a long-form length script", () => {
    const long = "word ".repeat(9000);
    expect(parseVersionInput({ script: long }).script).toHaveLength(45_000);
  });

  it("ignores formats it doesn't version", () => {
    expect(parseVersionInput({ writtenFrom: "thread" })).toEqual({});
  });
});

describe("format fields elsewhere", () => {
  it("accepts a lead format on an idea", () => {
    expect(parseIdeaFields({ leadFormat: "article" }).leadFormat).toBe(
      "article",
    );
    expect(
      parseIdeaFields({ leadFormat: "carousel" }).leadFormat,
    ).toBeUndefined();
  });

  it("accepts a default format on the project", () => {
    expect(parseProjectInput({ defaultFormat: "long" }).defaultFormat).toBe(
      "long",
    );
    expect(
      parseProjectInput({ defaultFormat: "thread" }).defaultFormat,
    ).toBeUndefined();
  });

  it("orders and filters skill formats", () => {
    expect(parseSkillFormats(["article", "short", "thread", "short"])).toEqual([
      "short",
      "article",
    ]);
  });
});
