import contract from "../../../protocol/app-actions.schema.json";

type Json = Record<string, unknown>;
const definitions = contract.$defs as Record<string, Json>;

/** A contract definition with its references written out, since a tool's schema travels alone. */
export function inlined(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(inlined);
  if (!schema || typeof schema !== "object") return schema;
  const node = schema as Json;
  if (typeof node.$ref === "string") {
    return inlined(definitions[node.$ref.split("/").at(-1)!]);
  }
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [key, inlined(value)]),
  );
}

export const inputSchemaFor = (definition: string): Json =>
  inlined(definitions[definition]) as Json;

export const definitionFor = (name: string) => definitions[name];
