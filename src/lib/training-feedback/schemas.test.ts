import { describe, expect, it } from "vitest";
import {
  COACHING_RESPONSE_FORMAT,
  COACHING_SCHEMA,
  SCORING_RESPONSE_FORMAT,
  SCORING_SCHEMA,
} from "@/lib/training-feedback/schemas";
import {
  CORRECTION_TYPES,
  STRUCTURAL_GAP_KINDS,
  TRAINING_DIMENSIONS,
} from "@/lib/training-feedback/types";

type Schema = Record<string, unknown>;

const properties = (schema: Schema): Record<string, Schema> =>
  schema.properties as Record<string, Schema>;

describe("SCORING_SCHEMA", () => {
  const scores = properties(SCORING_SCHEMA).scores;
  const rationales = properties(SCORING_SCHEMA).rationales;

  it("requires every dimension plus overall in scores", () => {
    expect(scores.required).toEqual([...TRAINING_DIMENSIONS, "overall"]);
    for (const key of scores.required as string[]) {
      expect(properties(scores)[key]).toEqual({ type: "integer" });
    }
  });

  it("requires a string rationale per dimension, and nothing extra", () => {
    expect(rationales.required).toEqual([...TRAINING_DIMENSIONS]);
    expect(rationales.additionalProperties).toBe(false);
    expect(properties(rationales).clarity).toEqual({ type: "string" });
  });

  it("locks the top level down to scores and rationales", () => {
    expect(SCORING_SCHEMA.required).toEqual(["scores", "rationales"]);
    expect(SCORING_SCHEMA.additionalProperties).toBe(false);
  });
});

describe("COACHING_SCHEMA", () => {
  it("requires every coaching field", () => {
    expect(COACHING_SCHEMA.required).toEqual([
      "overview",
      "strengths",
      "improvements",
      "corrections",
      "upgradeLines",
      "polishedTranscript",
      "structuralGaps",
    ]);
    expect(COACHING_SCHEMA.additionalProperties).toBe(false);
  });

  it("constrains correction entries to the contract's shape", () => {
    const item = properties(COACHING_SCHEMA).corrections.items as Schema;
    expect(item.required).toEqual([
      "type",
      "wordIndex",
      "wordCount",
      "fix",
      "note",
    ]);
    const p = properties(item);
    expect(p.type.enum).toEqual([...CORRECTION_TYPES]);
    expect(p.wordIndex).toEqual({ type: "integer" });
    expect(p.fix.type).toEqual(["string", "null"]);
  });

  it("constrains structural gaps to the known kinds and severities", () => {
    const item = properties(COACHING_SCHEMA).structuralGaps.items as Schema;
    const p = properties(item);
    expect(p.kind.enum).toEqual([...STRUCTURAL_GAP_KINDS]);
    expect(p.severity.enum).toEqual(["medium", "high"]);
  });
});

describe("response formats", () => {
  it("wraps each schema as a strict json_schema response format", () => {
    expect(SCORING_RESPONSE_FORMAT.type).toBe("json_schema");
    expect(SCORING_RESPONSE_FORMAT.json_schema.strict).toBe(true);
    expect(SCORING_RESPONSE_FORMAT.json_schema.schema).toBe(SCORING_SCHEMA);
    expect(COACHING_RESPONSE_FORMAT.json_schema.name).toBe("training_coaching");
    expect(COACHING_RESPONSE_FORMAT.json_schema.schema).toBe(COACHING_SCHEMA);
  });

  it("keeps both schemas JSON-serializable", () => {
    expect(() => JSON.stringify(SCORING_RESPONSE_FORMAT)).not.toThrow();
    expect(() => JSON.stringify(COACHING_RESPONSE_FORMAT)).not.toThrow();
  });
});
