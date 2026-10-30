import type { ChatTool } from "@/lib/studio/scene/scene-model-call";
import { record } from "../protocol";
import { readSection } from "./sections";
import { readTranscript } from "./transcript-reads";

/** Never varies per request: the tool list is part of the cached prefix. */
export const READ_TOOLS: readonly ChatTool[] = [
  {
    type: "function",
    function: {
      name: "read_section",
      description:
        "Read a project section listed in withheldSections (or any context key). Arrays come back one page at a time: filter by item ids, by a timeline window from/to in seconds (items with start/end or time), and continue with nextOffset.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["section"],
        properties: {
          section: { type: "string" },
          ids: { type: "array", items: { type: "string" } },
          from: { type: "number" },
          to: { type: "number" },
          offset: { type: "integer", minimum: 0 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_transcript",
      description:
        "Read the numbered transcript. With phrase: every occurrence of those words with their word numbers and surrounding words. With fromWord/toWord: that range (up to 600 words). Brackets mark cut words and pauses.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          phrase: { type: "string" },
          fromWord: { type: "integer", minimum: 0 },
          toWord: { type: "integer", minimum: 0 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_overlay_image",
      description:
        "Attach the selected overlay's source image so you can locate a region in it. Only available when selectedOverlayImage is in the context.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
  },
];

export interface ReadResult {
  content: string;
  /** A JPEG to show the model after the tool results. */
  image?: string;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function runReadTool(
  name: string,
  rawArguments: string,
  context: Record<string, unknown>,
  image: string | undefined,
): ReadResult {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawArguments || "{}");
    if (record(parsed)) args = parsed;
  } catch {
    return { content: JSON.stringify({ error: "Arguments must be JSON." }) };
  }
  switch (name) {
    case "read_section":
      return {
        content: JSON.stringify(
          readSection(context, {
            section: String(args.section ?? ""),
            ids: Array.isArray(args.ids)
              ? args.ids.filter((id): id is string => typeof id === "string")
              : undefined,
            from: numberOrUndefined(args.from),
            to: numberOrUndefined(args.to),
            offset: numberOrUndefined(args.offset),
          }),
        ),
      };
    case "read_transcript":
      return {
        content: JSON.stringify(
          readTranscript(context.transcript, {
            phrase: typeof args.phrase === "string" ? args.phrase : undefined,
            fromWord: numberOrUndefined(args.fromWord),
            toWord: numberOrUndefined(args.toWord),
          }),
        ),
      };
    case "view_overlay_image":
      return image
        ? {
            content: JSON.stringify({ attached: true }),
            image,
          }
        : {
            content: JSON.stringify({
              error: "No overlay image is selected in this request.",
            }),
          };
    default:
      return { content: JSON.stringify({ error: `No tool named ${name}.` }) };
  }
}
