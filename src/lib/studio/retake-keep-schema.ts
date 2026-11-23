/**
 * The keep only answer as a strict JSON schema, bounded to one transcript.
 *
 * Sent as `response_format`, it leaves the model one thing it can produce: the
 * list of kept spans. Without it, about one call in seven on Gemini 3.7 Flash
 * came back with no text at all and its answer inside a call to a function
 * that was never offered (`finish_reason: "tool_calls"`). Measured 2026-11-23
 * across three takes: 12 of 88 calls without the schema, 0 of 124 with it.
 * Each of those cost a whole second call. `tool_choice: "none"` did not stop
 * them.
 *
 * Every index carries the real upper bound, so a word index outside the
 * transcript is refused while the answer is written. `retake-keep-spans.ts`
 * still reads the answer and still decides whether it can be trusted.
 */
export function keptSpansResponseFormat(wordCount: number) {
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
