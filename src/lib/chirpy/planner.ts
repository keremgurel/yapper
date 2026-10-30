import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { extractJsonObject } from "@/lib/studio/scene/reply-json";
import {
  parsePlanReply,
  planValidationIssue,
  type PlanInput,
} from "./protocol";
import { CHIRPY_SYSTEM } from "./system-prompt";
import {
  CHIRPY_MAX_COMPLETION_TOKENS,
  CHIRPY_TIMEOUT_MS,
  chirpyModel,
  planReference,
  splitOverlayImage,
} from "./plan-request";
import { planWithReads } from "./loop/read-loop";

export { CHIRPY_SYSTEM };

/** One planning call with the whole project in the prompt, or, with
 * CHIRPY_PLANNER=reads, the loop that reads large sections on demand. */
export async function planChirpy(input: PlanInput, signal?: AbortSignal) {
  if (process.env.CHIRPY_PLANNER === "reads")
    return planWithReads(input, signal);
  const { context, image } = splitOverlayImage(
    input.context,
    "The attached image is the selected overlay source. Coordinates are fractions of the entire attached image from its top left. Include both the initial and final state of any animated property.",
  );
  const request = {
    model: chirpyModel(),
    system: CHIRPY_SYSTEM,
    ...planReference(input, CHIRPY_SYSTEM),
    user: JSON.stringify({ messages: input.messages, context }),
    images: image ? [image] : undefined,
    maxCompletionTokens: CHIRPY_MAX_COMPLETION_TOKENS,
    timeoutMs: CHIRPY_TIMEOUT_MS,
    signal,
  };
  // Repair a malformed plan before anything can execute. Both calls share the
  // original deadline and the ledger still charges only one successful plan.
  const deadline = Date.now() + request.timeoutMs;
  let issue: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("timeout");
    const reply = await callSceneModel({
      ...request,
      timeoutMs: remaining,
      user: issue
        ? `${request.user}\nThe previous reply failed validation: ${issue}. Return a complete corrected plan using only the advertised actions. If unavailable, return an explanation with no actions.`
        : request.user,
    });
    const raw = extractJsonObject(reply.content);
    const plan = parsePlanReply(raw, input);
    if (plan) return plan;
    issue = planValidationIssue(raw, input);
  }
  throw new Error("invalid_action_plan");
}
