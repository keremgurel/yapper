import contract from "../../../protocol/app-actions.schema.json";
import type { ChirpyPlanReply } from "../../../protocol/app-actions.generated";

type Schema = {
  type?: string;
  $ref?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: unknown;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  format?: string;
};
const definitions = contract.$defs as Record<string, Schema>;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Validate the same deliberately small schema vocabulary as the native app. */
export function validate(value: unknown, schema: Schema): boolean {
  if (schema.$ref)
    return validate(value, definitions[schema.$ref.split("/").at(-1)!]);
  if (schema.const !== undefined && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  switch (schema.type) {
    case "object":
      return (
        record(value) &&
        (schema.required ?? []).every((key) => Object.hasOwn(value, key)) &&
        Object.entries(value).every(([key, item]) =>
          schema.properties?.[key]
            ? validate(item, schema.properties[key])
            : schema.additionalProperties !== false,
        )
      );
    case "array":
      return (
        Array.isArray(value) &&
        value.length >= (schema.minItems ?? 0) &&
        value.length <= (schema.maxItems ?? Infinity) &&
        (!schema.uniqueItems ||
          new Set(value.map((item) => JSON.stringify(item))).size ===
            value.length) &&
        value.every((item) => validate(item, schema.items!))
      );
    case "string":
      return (
        typeof value === "string" &&
        value.length >= (schema.minLength ?? 0) &&
        value.length <= (schema.maxLength ?? Infinity) &&
        (schema.format !== "uuid" || UUID.test(value))
      );
    case "integer":
    case "number":
      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (schema.type !== "integer" || Number.isInteger(value)) &&
        value >= (schema.minimum ?? -Infinity) &&
        value <= (schema.maximum ?? Infinity)
      );
    case "boolean":
      return typeof value === "boolean";
    default:
      return false;
  }
}

export interface PlanInput {
  protocolVersion: 1;
  executionID: string;
  projectID: string;
  sessionID: string;
  revision: number;
  context: Record<string, unknown>;
  catalog: Array<{ id: string }>;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}
export function parsePlanInput(raw: unknown): PlanInput | null {
  if (
    !record(raw) ||
    raw.protocolVersion !== 1 ||
    ![raw.executionID, raw.projectID, raw.sessionID].every(
      (id) => typeof id === "string" && UUID.test(id),
    ) ||
    !Number.isSafeInteger(raw.revision) ||
    (raw.revision as number) < 0 ||
    !record(raw.context)
  )
    return null;
  if (
    raw.context.projectID !== raw.projectID ||
    raw.context.sessionID !== raw.sessionID ||
    raw.context.revision !== raw.revision
  )
    return null;
  if (
    !Array.isArray(raw.catalog) ||
    !raw.catalog.length ||
    raw.catalog.length > 128 ||
    !raw.catalog.every(
      (item) =>
        record(item) &&
        contract["x-actions"].some((action) => action.id === item.id),
    )
  )
    return null;
  if (
    !Array.isArray(raw.messages) ||
    !raw.messages.length ||
    raw.messages.length > 20 ||
    !raw.messages.every(
      (item) =>
        record(item) &&
        ["user", "assistant"].includes(item.role as string) &&
        typeof item.content === "string" &&
        item.content.length <= 6000,
    ) ||
    raw.messages.at(-1).role !== "user"
  )
    return null;
  return raw as unknown as PlanInput;
}

export function discoveredCatalog(input: PlanInput) {
  const ids = new Set(input.catalog.map((item) => item.id));
  return contract["x-actions"]
    .filter((action) => ids.has(action.id))
    .map((action) => ({ ...action, parameters: definitions[action.input] }));
}
export function parsePlanReply(
  raw: unknown,
  input: PlanInput,
): ChirpyPlanReply | null {
  if (!validate(raw, definitions.ChirpyPlanReply)) return null;
  const reply = raw as ChirpyPlanReply;
  const catalog = discoveredCatalog(input);
  for (const call of reply.actions) {
    const action = catalog.find((item) => item.id === call.action);
    if (!action || !validate(call.arguments, action.parameters)) return null;
    if (action.effect === "workflow" && reply.actions.length !== 1) return null;
  }
  return reply;
}
export const schemaDefinitions = definitions;
