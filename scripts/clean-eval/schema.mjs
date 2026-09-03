/**
 * The response contract as a strict JSON schema, bounded to this transcript.
 *
 * Every index carries the real upper bound, so an out of range word index is
 * refused at generation time instead of by the validator afterwards.
 */
export function retakeEditSchema(wordCount) {
  const index = { type: "integer", minimum: 0, maximum: wordCount - 1 };
  const span = { type: "array", items: index, minItems: 2, maxItems: 2 };
  return {
    type: "json_schema",
    json_schema: {
      name: "retake_edit",
      strict: true,
      schema: {
        type: "object",
        properties: {
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                topic: { type: "string" },
                keep: { type: "array", items: span },
                drop: { type: "array", items: span },
              },
              required: ["topic", "keep", "drop"],
              additionalProperties: false,
            },
          },
        },
        required: ["blocks"],
        additionalProperties: false,
      },
    },
  };
}

/** Keep only contract as a strict schema. */
export function keepOnlySchema(wordCount) {
  const index = { type: "integer", minimum: 0, maximum: wordCount - 1 };
  const span = { type: "array", items: index, minItems: 2, maxItems: 2 };
  return {
    type: "json_schema",
    json_schema: {
      name: "kept_spans",
      strict: true,
      schema: {
        type: "object",
        properties: { keep: { type: "array", items: span } },
        required: ["keep"],
        additionalProperties: false,
      },
    },
  };
}
