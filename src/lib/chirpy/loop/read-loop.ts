import {
  callSceneModel,
  type ChatMessage,
} from "@/lib/studio/scene/scene-model-call";
import { extractJsonObject } from "@/lib/studio/scene/reply-json";
import {
  parsePlanReply,
  planValidationIssue,
  type PlanInput,
} from "../protocol";
import {
  CHIRPY_MAX_COMPLETION_TOKENS,
  CHIRPY_TIMEOUT_MS,
  chirpyModel,
  planReference,
  splitOverlayImage,
} from "../plan-request";
import { CHIRPY_READING_SYSTEM } from "./loop-prompt";
import { READ_TOOLS, runReadTool } from "./read-tools";
import { SMALL_SECTION_BYTES, splitContext } from "./sections";

/** Model calls per turn, including one repair of an invalid plan. */
const MAX_CALLS = 4;
/** Tool calls per turn, across all model calls. */
const MAX_READS = 6;
/** About 4k tokens of project inline before sections are withheld. */
const DEFAULT_INLINE_BYTES = 16_000;

function bytesSetting(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const REPAIR =
  "Return a complete corrected plan using only the advertised actions. If unavailable, return an explanation with no actions.";

/**
 * Plan with the project's large sections withheld from the prompt. The model
 * reads what it needs through tools answered from the uploaded context, so a
 * long transcript costs tokens only when a request is about it. Every call in
 * a turn only appends to the previous one, so each reuses the last from the
 * provider's cache. Bounded by calls, reads and the planner's deadline; the
 * last call must answer.
 */
export async function planWithReads(input: PlanInput, signal?: AbortSignal) {
  const { context, image } = splitOverlayImage(
    input.context,
    "Call view_overlay_image to see the selected overlay source. Coordinates are fractions of the entire image from its top left. Include both the initial and final state of any animated property.",
  );
  // Tuning knobs; the eval sets both to 0 to make every case read.
  const { overview } = splitContext(
    context,
    bytesSetting("CHIRPY_INLINE_BYTES", DEFAULT_INLINE_BYTES),
    bytesSetting("CHIRPY_SMALL_SECTION_BYTES", SMALL_SECTION_BYTES),
  );
  const base = {
    model: chirpyModel(),
    system: CHIRPY_READING_SYSTEM,
    ...planReference(input, CHIRPY_READING_SYSTEM),
    user: JSON.stringify({ messages: input.messages, project: overview }),
    tools: READ_TOOLS,
    maxCompletionTokens: CHIRPY_MAX_COMPLETION_TOKENS,
    signal,
  };
  const followUp: ChatMessage[] = [];
  const deadline = Date.now() + CHIRPY_TIMEOUT_MS;
  let reads = 0;
  let repaired = false;
  for (let call = 0; call < MAX_CALLS; call++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("timeout");
    const mustAnswer = call === MAX_CALLS - 1 || reads >= MAX_READS;
    const reply = await callSceneModel({
      ...base,
      followUp,
      toolChoice: mustAnswer ? "none" : "auto",
      timeoutMs: remaining,
    });
    if (reply.toolCalls?.length) {
      followUp.push({
        role: "assistant",
        content: reply.content || null,
        tool_calls: reply.toolCalls,
      });
      const images: string[] = [];
      for (const toolCall of reply.toolCalls) {
        reads += 1;
        const result =
          reads > MAX_READS
            ? { content: '{"error":"Read limit reached. Answer now."}' }
            : runReadTool(
                toolCall.function.name,
                toolCall.function.arguments,
                context,
                image,
              );
        followUp.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result.content,
        });
        if (result.image) images.push(result.image);
      }
      if (images.length)
        followUp.push({
          role: "user",
          content: [
            { type: "text", text: "The selected overlay's source image." },
            ...images.map((jpeg) => ({
              type: "image_url" as const,
              image_url: {
                url: `data:image/jpeg;base64,${jpeg}`,
                detail: "high",
              },
            })),
          ],
        });
      continue;
    }
    const raw = extractJsonObject(reply.content);
    const plan = parsePlanReply(raw, input);
    if (plan) return plan;
    if (repaired) break;
    repaired = true;
    followUp.push(
      { role: "assistant", content: reply.content },
      {
        role: "user",
        content: `The previous reply failed validation: ${planValidationIssue(raw, input)}. ${REPAIR}`,
      },
    );
  }
  throw new Error("invalid_action_plan");
}
