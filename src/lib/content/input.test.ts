import { describe, expect, it } from "vitest";
import { parseContentInput } from "@/lib/content/input";

describe("parseContentInput", () => {
  it("returns an empty input and no bad-status flag for an empty body", () => {
    const { input, badStatus } = parseContentInput({});
    expect(input).toEqual({});
    expect(badStatus).toBe(false);
  });

  it("ignores unknown keys and non-string scalars", () => {
    // title as a number is not a string, so it is dropped rather than coerced.
    const { input } = parseContentInput({ title: 123, nonsense: "x" });
    expect(input).toEqual({});
  });

  it("clamps long strings to their field limit", () => {
    const { input } = parseContentInput({
      title: "t".repeat(400), // TITLE_MAX 300
      script: "s".repeat(30_000), // SCRIPT_MAX 20000
    });
    expect(input.title).toHaveLength(300);
    expect(input.script).toHaveLength(20_000);
  });

  it("clamps arrays to 20 items and each line to its limit", () => {
    const { input } = parseContentInput({
      hooks: Array.from({ length: 25 }, () => "h".repeat(400)),
    });
    expect(input.hooks).toHaveLength(20);
    expect(input.hooks!.every((h) => h.length === 300)).toBe(true);
  });

  it("drops non-string members of an array field", () => {
    const { input } = parseContentInput({ points: ["a", 5, null, "b"] });
    expect(input.points).toEqual(["a", "b"]);
  });

  it("accepts a valid status", () => {
    const { input, badStatus } = parseContentInput({ status: "scheduled" });
    expect(input.status).toBe("scheduled");
    expect(badStatus).toBe(false);
  });

  it("flags an invalid status instead of silently applying it", () => {
    const { input, badStatus } = parseContentInput({ status: "archived" });
    expect(input.status).toBeUndefined();
    expect(badStatus).toBe(true);
  });

  it("treats explicit null as a clear for the nullable fields", () => {
    const { input } = parseContentInput({
      script: null,
      pillar: null,
      scheduledFor: null,
    });
    expect(input.script).toBeNull();
    expect(input.pillar).toBeNull();
    expect(input.scheduledFor).toBeNull();
  });

  it("does not treat null as a clear for a non-nullable field", () => {
    // title has no null-clear path, so a null title is simply ignored.
    const { input } = parseContentInput({ title: null });
    expect("title" in input).toBe(false);
  });

  it("parses a valid date and ignores an unparseable one", () => {
    const ok = parseContentInput({ scheduledFor: "2026-07-15T00:00:00.000Z" });
    expect(ok.input.scheduledFor).toBeInstanceOf(Date);
    expect((ok.input.scheduledFor as Date).getTime()).toBe(
      Date.parse("2026-07-15T00:00:00.000Z"),
    );

    const bad = parseContentInput({ scheduledFor: "not a date" });
    expect("scheduledFor" in bad.input).toBe(false);
  });
});
