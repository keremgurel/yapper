import type { EditInput } from "./revise-input";
import { callSceneModel } from "./scene-model-call";
import { extractJsonObject } from "./reply-json";
import { finiteBetween } from "./input-guards";
import type { OverlayScene } from "./scene-types";
import { SCENE_LIMITS } from "./scene-limits";

export interface RevisionPlan {
  openingHoldSeconds: number | null;
  sceneInstruction: string | null;
  duration: number | null;
  placementQuote: string | null;
  timelineShiftSeconds: number | null;
}
export async function planRevision(
  input: EditInput,
  model: string,
  signal?: AbortSignal,
): Promise<RevisionPlan> {
  const { content } = await callSceneModel({
    model,
    signal,
    timeoutMs: 45_000,
    maxCompletionTokens: 1500,
    system: [
      "Translate the creator's requested changes into editing operations. Animation timing and timeline placement are independent and can be combined. Preserve everything not requested; distinguish requested actions from explanations or future intentions.",
      'Return JSON only with all fields: {"openingHoldSeconds":null,"sceneInstruction":null,"duration":null,"placementQuote":null,"timelineShiftSeconds":null}.',
      "openingHoldSeconds: total initial-state hold before the transition, in seconds. The executor preserves transition/final-hold lengths and adjusts total duration automatically.",
      "sceneInstruction: additional design/content/motion changes not covered by the timing fields, otherwise null.",
      "duration: explicitly requested total duration, otherwise null.",
      "placementQuote: verbatim contiguous transcript words locating a requested new timeline start, otherwise null. Internal timing edits do not imply permission to change timeline placement.",
      "timelineShiftSeconds: requested relative timeline movement (negative for earlier), otherwise null. Use at most one placement field.",
    ].join("\n"),
    user: JSON.stringify({
      request: input.instruction,
      currentDuration: input.duration,
      asset: input.asset,
      transcript: input.words.map((w) => w.text).join(" "),
    }),
  });
  const p = extractJsonObject(content);
  if (!p) throw new Error("invalid_revision_plan");
  for (const field of [
    "openingHoldSeconds",
    "duration",
    "timelineShiftSeconds",
  ] as const) {
    if (
      p[field] !== null &&
      !finiteBetween(
        p[field],
        field === "timelineShiftSeconds" ? -7200 : 0,
        field === "timelineShiftSeconds" ? 7200 : SCENE_LIMITS.maxDuration,
      )
    )
      throw new Error("invalid_revision_plan");
  }
  for (const field of ["sceneInstruction", "placementQuote"] as const) {
    if (
      p[field] !== null &&
      (typeof p[field] !== "string" ||
        !(p[field] as string).trim() ||
        (p[field] as string).length > 1000)
    )
      throw new Error("invalid_revision_plan");
  }
  if (p.placementQuote && p.timelineShiftSeconds !== null)
    throw new Error("invalid_revision_plan");
  if (
    p.placementQuote &&
    !input.words
      .map((w) => w.text)
      .join(" ")
      .includes(p.placementQuote as string)
  )
    throw new Error("invalid_quote");
  return p as unknown as RevisionPlan;
}

/** Insert/remove time at the end of the initial state, not before entrance.
 * No geometry, wording, values, easing or asset references are regenerated. */
export function withOpeningHold(
  scene: OverlayScene,
  seconds: number,
): OverlayScene {
  const transitions = scene.animations.filter((a) => a.property === "value");
  if (!transitions.length) throw new Error("opening_hold_requires_counter");
  const boundary = Math.min(...transitions.map((a) => a.start));
  const delta = seconds - boundary;
  const duration = scene.duration + delta;
  if (
    duration < SCENE_LIMITS.minDuration ||
    duration > SCENE_LIMITS.maxDuration
  )
    throw new Error("invalid_duration");
  if (scene.animations.some((a) => a.start < boundary && a.end > boundary))
    throw new Error("complex_opening_hold");
  return {
    ...scene,
    duration,
    poster: Math.min(
      duration,
      scene.poster >= boundary ? scene.poster + delta : scene.poster,
    ),
    animations: scene.animations.map((a) =>
      a.start >= boundary
        ? { ...a, start: a.start + delta, end: a.end + delta }
        : a,
    ),
  };
}
