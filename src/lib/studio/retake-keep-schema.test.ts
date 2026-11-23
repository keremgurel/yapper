import { describe, expect, it } from "vitest";
import { keptSpansResponseFormat } from "./retake-keep-schema";

describe("keptSpansResponseFormat", () => {
  const format = keptSpansResponseFormat(1_399);
  const keep = format.json_schema.schema.properties.keep;

  it("allows nothing but the list of kept spans", () => {
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.schema.required).toEqual(["keep"]);
    expect(format.json_schema.schema.additionalProperties).toBe(false);
  });

  it("makes every span a pair of word indices inside this transcript", () => {
    expect(keep.items).toMatchObject({ minItems: 2, maxItems: 2 });
    expect(keep.items.items).toEqual({
      type: "integer",
      minimum: 0,
      maximum: 1_398,
    });
  });
});
