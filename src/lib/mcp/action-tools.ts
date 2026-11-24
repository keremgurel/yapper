import { studioExecutor } from "@/lib/chirpy/studio/actions";
import { StudioActionFailure } from "@/lib/chirpy/studio/executor";
import { validate } from "@/lib/chirpy/protocol";
import type { StudioActionID } from "@/lib/chirpy/studio/registry.generated";
import { offeredActions, toolName } from "./offered-actions";
import { definitionFor, inputSchemaFor } from "./tool-schema";
import {
  toolResult,
  type McpCaller,
  type McpTool,
  type McpToolResult,
} from "./tool-types";

/** One tool per offered action, described by the contract's own words and schema. */
export function actionTools(): McpTool[] {
  return offeredActions().map((action) => ({
    name: toolName(action.id),
    title: action.id,
    description: action.description,
    inputSchema: inputSchemaFor(action.input),
    annotations: {
      readOnlyHint: false,
      destructiveHint: action.effect === "destructive",
    },
  }));
}

/**
 * Runs an offered action through the executor a Chirpy turn uses, after the
 * same schema check. `null` when the name is not an offered action.
 */
export async function callActionTool(
  caller: McpCaller,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult | null> {
  const action = offeredActions().find(
    (candidate) => toolName(candidate.id) === name,
  );
  if (!action) return null;
  if (!validate(args, definitionFor(action.input))) {
    return toolResult(
      `Those arguments do not match ${action.input}. Check required fields, allowed values and extra fields.`,
      undefined,
      true,
    );
  }
  try {
    const outcome = await studioExecutor(action.id as StudioActionID).run(
      args,
      {
        userId: caller.userId,
        request: caller.request,
        timeZone: "UTC",
      },
    );
    return toolResult(outcome.summary, outcome.data);
  } catch (error) {
    if (error instanceof StudioActionFailure)
      return toolResult(error.sentence, undefined, true);
    console.error(
      "[mcp] action failed",
      action.id,
      error instanceof Error ? error.message : "unknown",
    );
    return toolResult("That change did not go through.", undefined, true);
  }
}
