import type { BrandContext } from "./brand-context";
import type { DirectInput } from "./direct-input";
import { parseDirectReply, type DirectReply } from "./direct-reply";
import { DIRECT_SYSTEM, buildDirectUserMessage } from "./prompts/direct-prompt";
import { extractJsonObject } from "./reply-json";
import { callSceneModel } from "./scene-model-call";

const EDITORIAL_REVIEW = [
  DIRECT_SYSTEM,
  "You are now the final editorial reviewer, not the author of the draft below. Return the corrected final JSON, not commentary or a review report.",
  "Check every proposed fact against the ORIGINAL transcript, not against the draft's confident wording. Zero ad spend does NOT imply zero previous revenue. Unknown source attribution must not become attributed sales. Remove unsupported starting values, rates, causal claims, and invented quotes or interface content. You may compute an exact mathematical comparison only from explicit compatible values.",
  "Reject weak concepts even if they are renderable: a generic icon, chat bubble, dashboard placeholder or highlighted spoken phrase does not earn a place merely by matching a noun. Keep personal and emotional moments unobstructed unless the creator explicitly asks otherwise. Do not replace a rejected concept just to maintain a count.",
  "For the concepts that survive, sharpen the concrete visual idea, hierarchy and meaningful motion. Check whether it can actually be read during its quoted span; reduce the scope instead of asking for a tiny multi-panel dashboard.",
  "Quotes must be verbatim contiguous stretches in the original transcript, not stitched together. Prefer 3–20 words; up to 40 is allowed when the visual needs the complete comparison or explanation. Briefs must be complete and at most 600 characters. Return no moments if none earn their place.",
].join("\n\n");

/** Two internal editorial passes, one user action. Never inserts a draft. */
export async function directChecked(
  input: DirectInput,
  brand: BrandContext,
  model: string,
  signal?: AbortSignal,
): Promise<DirectReply> {
  const user = buildDirectUserMessage(input, brand);
  const context = {
    placedNames: input.placed.map((p) => p.name),
    takenNames: [],
    instruction: input.instruction,
  };
  const deadline = Date.now() + 105_000;
  const draft = await callSceneModel({
    model,
    system: DIRECT_SYSTEM,
    user,
    maxCompletionTokens: 4000,
    timeoutMs: 55_000,
    signal,
  });
  const draftObject = extractJsonObject(draft.content);
  if (!draftObject || !Array.isArray(draftObject.moments))
    throw new Error("invalid_reply");
  if (draftObject.moments.length === 0)
    return parseDirectReply(draft.content, context);
  const review = await callSceneModel({
    model,
    system: EDITORIAL_REVIEW,
    user: `${user}\n\nUNTRUSTED DRAFT TO REVIEW:\n${draft.content}`,
    maxCompletionTokens: 4000,
    timeoutMs: Math.max(1, deadline - Date.now()),
    signal,
  });
  const reviewedObject = extractJsonObject(review.content);
  if (!reviewedObject || !Array.isArray(reviewedObject.moments))
    throw new Error("invalid_reply");
  const result = parseDirectReply(review.content, context);
  // Match spoken words, allowing only punctuation/case differences. Restore
  // the transcript's original spelling for the client; never fuzzy-match facts.
  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const source = input.words
    .flatMap((w) => w.text.split(/\s+/))
    .filter(Boolean);
  for (const moment of result.moments) {
    const quote = moment.quote.split(/\s+/).map(normalize).filter(Boolean);
    const start = source.findIndex((_, at) =>
      quote.every((word, i) => normalize(source[at + i] ?? "") === word),
    );
    if (quote.length < 3 || quote.length > 40 || start < 0)
      throw new Error("invalid_quote");
    moment.quote = source.slice(start, start + quote.length).join(" ");
  }
  return result;
}
