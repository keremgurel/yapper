import { createHash } from "node:crypto";
import { callSceneModel } from "@/lib/studio/scene/scene-model-call";
import { extractJsonObject } from "@/lib/studio/scene/reply-json";
import {
  parseStudioPlan,
  studioCatalog,
  studioDefinitions,
  studioPlanIssue,
  type StudioPlan,
} from "./catalog";
import type { IdeasOverview } from "./ideas/reads";
import { STUDIO_SYSTEM } from "./prompt";
import type { StudioTurnInput } from "./wire";

/** What the server read for this turn, plus the creator's calendar days. */
export interface StudioOverview extends IdeasOverview {
  today: { date: string; weekday: string; time: string; timeZone: string };
  upcoming: { date: string; weekday: string }[];
}

const REFERENCE = JSON.stringify({
  catalog: studioCatalog(),
  definitions: studioDefinitions(),
});
const CACHE_KEY = `chirpy-studio-${createHash("sha256")
  .update(STUDIO_SYSTEM)
  .update(REFERENCE)
  .digest("hex")
  .slice(0, 16)}`;

/** Claude Haiku 5.5 passed every Studio eval case at about a thirteenth of
 * gpt-5.4's list cost per turn (docs/chirpy-eval.md); AI_CHIRPY_STUDIO_MODEL
 * overrides it. */
export function studioModel(): string {
  return process.env.AI_CHIRPY_STUDIO_MODEL ?? "claude-haiku-5.5";
}

/** The part of the prompt that changes every turn, after the cached prefix. */
export function studioRequest(
  input: StudioTurnInput,
  overview: StudioOverview,
): string {
  return JSON.stringify({
    surface: input.surface,
    focus: input.focus ?? null,
    today: overview.today,
    upcoming: overview.upcoming,
    pillars: overview.pillars,
    views: overview.views,
    totalIdeas: overview.totalIdeas,
    ideas: overview.ideas,
    messages: input.messages,
  });
}

/**
 * Plan one Studio turn: one model call, plus one repair call when the reply
 * does not validate, inside a shared deadline. The ledger charges one plan.
 */
export async function planStudio(
  input: StudioTurnInput,
  overview: StudioOverview,
  signal?: AbortSignal,
): Promise<StudioPlan> {
  const user = studioRequest(input, overview);
  const deadline = Date.now() + 40_000;
  let issue: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("timeout");
    const reply = await callSceneModel({
      model: studioModel(),
      system: STUDIO_SYSTEM,
      reference: REFERENCE,
      promptCacheKey: CACHE_KEY,
      user: issue
        ? `${user}\nThe previous reply failed validation: ${issue} Return a complete corrected plan using only catalog actions, or an explanation with no actions.`
        : user,
      maxCompletionTokens: 2000,
      timeoutMs: remaining,
      signal,
    });
    const raw = extractJsonObject(reply.content);
    const plan = parseStudioPlan(raw);
    if (plan) return plan;
    issue = studioPlanIssue(raw);
  }
  throw new Error("invalid_action_plan");
}
