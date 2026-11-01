import contract from "../../../../protocol/app-actions.schema.json";
import type { ChirpyPlanReply } from "../../../../protocol/app-actions.generated";
import { validate } from "../protocol";
import { STUDIO_ACTIONS, type StudioActionID } from "./registry.generated";
import { isLocalDay, isLocalTime } from "./zoned-time";

type Schema = Parameters<typeof validate>[1];
const definitions = contract.$defs as Record<string, Schema>;

/** The server actions with their input schemas, in contract order. The same
 * for every turn, so it sits in the cached prefix of the prompt. */
export function studioCatalog() {
  return contract["x-actions"]
    .filter((action) => action.runtime === "server")
    .map((action) => ({
      id: action.id,
      description: action.description,
      effect: action.effect,
      ...("confirm" in action && action.confirm ? { confirm: true } : {}),
      input: action.input,
    }));
}

/** Only the definitions the catalog's inputs reach. */
export function studioDefinitions(): Record<string, Schema> {
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
  for (const action of studioCatalog()) {
    result[action.input] = definitions[action.input];
    visit(definitions[action.input]);
  }
  return result;
}

function descriptor(id: string) {
  return STUDIO_ACTIONS.find((action) => action.id === id);
}

/** Checks the schema vocabulary cannot express: real calendar days and
 * clock times. */
function argumentIssue(id: string, args: Record<string, unknown>) {
  if (args.date !== undefined && !isLocalDay(args.date))
    return `${id}: date must be a real day written YYYY-MM-DD.`;
  if (args.time !== undefined && !isLocalTime(args.time))
    return `${id}: time must be HH:MM on a 24-hour clock.`;
  if (args.time !== undefined && args.date === undefined)
    return `${id}: time needs a date.`;
  return null;
}

/** Why a reply is not an acceptable Studio plan, or null when it is. Bounded,
 * schema-owned wording: model prose is never echoed back. */
export function studioPlanIssue(raw: unknown): string | null {
  if (!validate(raw, definitions.ChirpyPlanReply))
    return "Use only message (string, at most 2000 characters) and actions (array, at most 8 actions).";
  const reply = raw as ChirpyPlanReply;
  if (!reply.actions.length && !reply.message.trim())
    return "With no actions, message must answer the creator or ask one short question.";
  for (const call of reply.actions) {
    const action = descriptor(call.action);
    if (!action)
      return `${call.action} is not a Studio action. Use only catalog ids, or return no actions and explain the limitation.`;
    if (!validate(call.arguments, definitions[action.input]))
      return `Arguments for ${action.id} do not match ${action.input}. Check required fields, enum values, UUIDs, lengths and extra fields.`;
    const issue = argumentIssue(action.id, call.arguments);
    if (issue) return issue;
  }
  return null;
}

export interface StudioPlanCall {
  action: StudioActionID;
  arguments: Record<string, unknown>;
}

export interface StudioPlan {
  message: string;
  actions: StudioPlanCall[];
}

export function parseStudioPlan(raw: unknown): StudioPlan | null {
  return studioPlanIssue(raw) === null ? (raw as StudioPlan) : null;
}
