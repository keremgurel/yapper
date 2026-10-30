import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../env.mjs";

/** The committed action contract: actions plus their $defs. */
export async function loadContract() {
  return JSON.parse(
    await fs.readFile(
      path.join(ROOT, "protocol/app-actions.schema.json"),
      "utf8",
    ),
  );
}

/**
 * The provider-strict variant of one schema, as the v2 plan describes it:
 * $refs inlined, every property listed in `required`, optional properties
 * made nullable (see `nullable`), `additionalProperties: false` on every object and
 * `uniqueItems` removed. `strip` drops further keywords (for example the
 * length and range limits) when a provider refuses them.
 */
export function toStrict(schema, defs, { strip = [] } = {}) {
  const convert = (node, stack) => {
    if (node.$ref) {
      const name = node.$ref.split("/").at(-1);
      if (stack.includes(name)) throw new Error(`recursive $ref ${name}`);
      return convert(defs[name], [...stack, name]);
    }
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "uniqueItems" || strip.includes(key)) continue;
      if (key === "properties") {
        const required = new Set(node.required ?? []);
        out.properties = Object.fromEntries(
          Object.entries(value).map(([name, child]) => {
            const strict = convert(child, stack);
            return [name, required.has(name) ? strict : nullable(strict)];
          }),
        );
      } else if (key === "items") out.items = convert(value, stack);
      else out[key] = value;
    }
    if (node.type === "object") {
      out.properties ??= {};
      out.required = Object.keys(out.properties);
      out.additionalProperties = false;
    }
    return out;
  };
  return convert(schema, []);
}

/**
 * A plain typed schema becomes `type: [t, "null"]`. Enums, consts and
 * anything without a single type use `anyOf` with null instead: Anthropic's
 * strict mode refuses an enum under a type array.
 */
function nullable(schema) {
  if (
    typeof schema.type === "string" &&
    !schema.enum &&
    schema.const === undefined
  )
    return { ...schema, type: [schema.type, "null"] };
  return { anyOf: [schema, { type: "null" }] };
}

/** Undo the nullable conversion: drop null-valued keys before validating. */
export function fromStrict(value) {
  if (Array.isArray(value)) return value.map(fromStrict);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, fromStrict(v)]),
    );
  return value;
}

/** Function names allow [a-zA-Z0-9_-]; action ids use dots. */
export const toolName = (id) => id.replaceAll(".", "_");

/** Every current (non-legacy) action as a strict function tool. */
export function actionTools(contract, options) {
  return contract["x-actions"]
    .filter((action) => !action.legacy)
    .map((action) => ({
      id: action.id,
      tool: {
        type: "function",
        function: {
          name: toolName(action.id),
          description: action.description,
          parameters: toStrict(
            contract.$defs[action.input],
            contract.$defs,
            options,
          ),
          strict: true,
        },
      },
    }));
}

/** The plan envelope as one strict json_schema: message plus typed actions. */
export function planResponseFormat(contract, options) {
  const branches = contract["x-actions"]
    .filter((action) => !action.legacy)
    .map((action) => ({
      type: "object",
      properties: {
        action: { type: "string", enum: [action.id] },
        arguments: toStrict(
          contract.$defs[action.input],
          contract.$defs,
          options,
        ),
      },
      required: ["action", "arguments"],
      additionalProperties: false,
    }));
  const actions = { type: "array", maxItems: 8, items: { anyOf: branches } };
  if (options?.strip?.includes("maxItems")) delete actions.maxItems;
  return {
    type: "json_schema",
    json_schema: {
      name: "chirpy_plan",
      strict: true,
      schema: {
        type: "object",
        properties: {
          message: { type: "string" },
          actions,
        },
        required: ["message", "actions"],
        additionalProperties: false,
      },
    },
  };
}

/** Keywords a strict provider might refuse; the probe's fallback arm drops them. */
export const LIMIT_KEYWORDS = [
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "format",
];
