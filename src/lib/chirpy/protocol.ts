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
  const image = raw.context.selectedOverlayImage;
  if (
    image !== undefined &&
    image !== null &&
    (!record(image) ||
      typeof image.overlayID !== "string" ||
      !UUID.test(image.overlayID) ||
      image.overlayID !== raw.context.selectedOverlayID ||
      typeof image.jpeg !== "string" ||
      image.jpeg.length > 200_000 ||
      !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(image.jpeg))
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
    !raw.catalog.every((item) => record(item) && typeof item.id === "string")
  )
    return null;
  // A newer client may advertise actions this server has not learned yet. Plan
  // over the ones both sides know rather than refusing the whole request; the
  // client reports anything the plan cannot reach as unsupported. Server-runtime
  // actions never enter a client plan.
  const catalog = raw.catalog.filter((item) =>
    contract["x-actions"].some(
      (action) => action.id === item.id && action.runtime === "client",
    ),
  );
  if (!catalog.length) return null;
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
  return { ...raw, catalog } as unknown as PlanInput;
}

export function discoveredCatalog(input: PlanInput) {
  const ids = new Set(input.catalog.map((item) => item.id));
  return contract["x-actions"]
    .filter((action) => ids.has(action.id))
    .map((action) => ({ ...action, parameters: definitions[action.input] }));
}
/** Workflows own their transaction, and app.* actions change which project
 * is open or act outside it, so neither can share an atomic batch. */
function runsAlone(action: { id: string; effect: string }): boolean {
  return action.effect === "workflow" || action.id.startsWith("app.");
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
    if (runsAlone(action) && reply.actions.length !== 1) return null;
  }
  return reply;
}
/** Send only definitions referenced by the available catalog; retired capabilities
 * and unrelated wire envelopes are not part of the model's editing vocabulary. */
export function schemaDefinitions(input: PlanInput): Record<string, Schema> {
  const result: Record<string, Schema> = {};
  function visit(schema: Schema) {
    if (schema.$ref) {
      const name = schema.$ref.split("/").at(-1)!;
      if (!result[name]) {
        result[name] = definitions[name];
        visit(definitions[name]);
      }
    }
    for (const child of Object.values(schema.properties ?? {})) visit(child);
    if (schema.items) visit(schema.items);
  }
  for (const action of discoveredCatalog(input)) visit(action.parameters);
  return result;
}

/** Bounded, schema-owned feedback; never echo model prose or arbitrary keys. */
export function planValidationIssue(raw: unknown, input: PlanInput): string {
  if (!validate(raw, definitions.ChirpyPlanReply))
    return "Use only message (string, at most 2000 characters) and actions (array, at most 8 actions). Use bulk targets for repeated edits.";
  const reply = raw as ChirpyPlanReply;
  const catalog = discoveredCatalog(input);
  for (const call of reply.actions) {
    const action = catalog.find((item) => item.id === call.action);
    if (!action)
      return "An action is not in this client's catalog. Use only advertised IDs or return no actions and explain the limitation.";
    if (!validate(call.arguments, action.parameters))
      return `Arguments for ${action.id} do not match its schema. Check required fields, enum values, UUIDs, numeric ranges and extra fields.`;
    if (runsAlone(action) && reply.actions.length !== 1)
      return action.effect === "workflow"
        ? "A workflow must run alone. Do not mix it with other actions."
        : "Project and dictionary actions must run alone. Do not mix them with other actions.";
  }
  return "Return a plan matching the supplied schemas.";
}
