import { readStylesOverview } from "@/lib/chirpy/studio/styles/reads";
import { UUID } from "@/lib/chirpy/protocol";
import { getStyleLook } from "@/lib/db/style-looks";
import { describeLook } from "@/lib/style-library/operations/look-template";
import {
  toolResult,
  type McpCaller,
  type McpTool,
  type McpToolResult,
} from "./tool-types";

/**
 * Chirpy never calls a tool to look things up: the server reads the account
 * and puts it in the prompt. A connector's model has no such prompt, so the
 * same readers are offered as read-only tools.
 */
const READ_ONLY = { readOnlyHint: true, destructiveHint: false };

export const CONTEXT_TOOLS: readonly McpTool[] = [
  {
    name: "studio_styles_context",
    title: "Style library and saved looks",
    description:
      "What Chirpy reads before changing a look: the library's templates, every block with its option keys and allowed values, and the creator's saved looks with each place and the block in it. Call this first.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "studio_styles_describe_look",
    title: "One saved look in full",
    description:
      "Every place in one saved look with the block in it, the styles that could go there instead, and each setting with its current value and limits.",
    inputSchema: {
      type: "object",
      required: ["lookID"],
      additionalProperties: false,
      properties: { lookID: { type: "string", format: "uuid" } },
    },
    annotations: READ_ONLY,
  },
];

export async function callContextTool(
  caller: McpCaller,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult | null> {
  if (name === "studio_styles_context") {
    return toolResult(
      "The style library and your looks.",
      await readStylesOverview(caller.userId),
    );
  }
  if (name === "studio_styles_describe_look") {
    const id =
      typeof args.lookID === "string" && UUID.test(args.lookID)
        ? args.lookID
        : null;
    const look = id ? await getStyleLook(caller.userId, id) : null;
    return look
      ? toolResult(`The look “${look.name}”.`, describeLook(look))
      : toolResult("There is no saved look with that id.", undefined, true);
  }
  return null;
}
