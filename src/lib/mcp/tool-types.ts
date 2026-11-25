/** A tool as a connector sees it. */
export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean };
}

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError: boolean;
}

/** Who is calling and how, for the executors behind a tool. */
export interface McpCaller {
  userId: string;
  request: Request;
}

/** A tool's answer: one sentence, and the state after it as JSON when there is some. */
export function toolResult(
  sentence: string,
  data?: unknown,
  isError = false,
): McpToolResult {
  const structured =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : undefined;
  return {
    content: [
      {
        type: "text",
        text:
          data === undefined
            ? sentence
            : `${sentence}\n${JSON.stringify(data)}`,
      },
    ],
    ...(structured ? { structuredContent: structured } : {}),
    isError,
  };
}
