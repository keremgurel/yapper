import { describe, expect, it } from "vitest";
import { parseCaption } from "@/lib/publish/caption";

describe("parseCaption", () => {
  it("pulls the JSON object out of surrounding prose and code fences", () => {
    const out = parseCaption(
      'Sure! ```json\n{"title":"Hi there","description":"a line"}\n```',
    );
    expect(out).toEqual({ title: "Hi there", description: "a line" });
  });

  it("clamps the title to 100 chars (YouTube's limit)", () => {
    const long = "t".repeat(150);
    const out = parseCaption(`{"title":"${long}","description":"d"}`);
    expect(out.title).toHaveLength(100);
  });

  it("clamps the description to 5000 chars", () => {
    const long = "d".repeat(6000);
    const out = parseCaption(`{"title":"t","description":"${long}"}`);
    expect(out.description).toHaveLength(5000);
  });

  it("drops non-string fields to an empty string", () => {
    const out = parseCaption('{"title":5,"description":"keep me"}');
    expect(out).toEqual({ title: "", description: "keep me" });
  });

  it("throws when there is no object to parse", () => {
    expect(() => parseCaption("no json at all")).toThrow("caption_unparseable");
    expect(() => parseCaption("}{")).toThrow("caption_unparseable");
  });

  it("throws when the object has neither a title nor a description", () => {
    expect(() => parseCaption("{}")).toThrow("caption_empty");
    expect(() => parseCaption('{"title":"","description":""}')).toThrow(
      "caption_empty",
    );
  });
});
