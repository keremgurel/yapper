import type { BrandContext } from "./brand-context";
import type { DesignMoment } from "./design-input";
import { buildDesignUserMessage, DESIGN_SYSTEM } from "./prompts/design-prompt";
import { mapWithConcurrency } from "./run-limited";
import {
  deliverScene,
  type DeliveredScene,
  type FailedScene,
  type ImageReservation,
} from "./scene-delivery";
import { sceneModelFailureReason } from "./scene-model-call";
import { uniqueOverlayName } from "./overlay-name";
import { designChecked } from "./design-checked";

export interface DesignMomentsInput {
  moments: readonly DesignMoment[];
  brand: BrandContext;
  instruction: string;
  frameAspect: number;
  frameHeightPx: number;
  model: string;
  signal?: AbortSignal;
  reserveImage?: () => Promise<ImageReservation | null>;
}

export interface DesignMomentsResult {
  scenes: DeliveredScene[];
  failed: FailedScene[];
}

/** Three designer calls in flight at once; see run-limited.ts. */
export const DESIGN_CONCURRENCY = 3;
export const DESIGN_MAX_COMPLETION_TOKENS = 6_000;
export const DESIGN_TIMEOUT_MS = 120_000;

/**
 * Design every moment in a batch. Each one is its own provider call and its
 * own outcome: one moment's bad scene does not cost the others, and the
 * caller refunds exactly the ones in `failed`.
 */
export async function designMoments(
  input: DesignMomentsInput,
): Promise<DesignMomentsResult> {
  const context = {
    brand: input.brand,
    instruction: input.instruction,
    frameAspect: input.frameAspect,
    frameHeightPx: input.frameHeightPx,
  };
  const outcomes = await mapWithConcurrency(
    input.moments,
    DESIGN_CONCURRENCY,
    async (moment) => {
      let content: string;
      try {
        content = await designChecked({
          model: input.model,
          system: DESIGN_SYSTEM,
          user: buildDesignUserMessage(moment, context),
          quality: {
            widthPx: moment.box.widthPx,
            heightPx: moment.box.heightPx,
            frameHeightPx: input.frameHeightPx,
            requireMotion: /animat|motion|counter/i.test(input.instruction),
          },
          duration: moment.duration,
          hasBrandLogo: input.brand.logos.length > 0,
          signal: input.signal,
        });
      } catch (error) {
        console.warn("[scene] design failed", {
          reason: sceneModelFailureReason(error),
        });
        return {
          ok: false as const,
          failed: { id: moment.id, reason: sceneModelFailureReason(error) },
        };
      }
      const delivery = await deliverScene({
        id: moment.id,
        reply: content,
        fallback: {
          brief: moment.brief,
          quote: moment.quote,
          name: moment.name,
          description: moment.description,
        },
        frameHeightPx: input.frameHeightPx,
        boxHeightPx: moment.box.heightPx,
        takenNames: [],
        hasBrandLogo: input.brand.logos.length > 0,
        reserveImage: input.reserveImage,
        signal: input.signal,
      });
      return delivery;
    },
  );
  // Assign names in input order after all asynchronous deliveries finish.
  // Otherwise two deliveries can both see an empty name list before either
  // caller resumes and claims its name.
  const takenNames: string[] = [];
  for (const outcome of outcomes) {
    if (!outcome.ok) continue;
    outcome.scene.name = uniqueOverlayName(outcome.scene.name, takenNames, "");
    takenNames.push(outcome.scene.name);
  }
  return {
    scenes: outcomes.flatMap((o) => (o.ok ? [o.scene] : [])),
    failed: outcomes.flatMap((o) => (o.ok ? [] : [o.failed])),
  };
}
