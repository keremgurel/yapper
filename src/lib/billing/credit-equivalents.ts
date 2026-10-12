import { PAID_ACTIONS } from "./paid-actions";
import type { CreditPack } from "./plans";

/**
 * What one finished short video costs in credits when a creator leans on the
 * AI tools: a written script, about six minutes of takes transcribed, a
 * 1-Click Edit, overlay planning with two designed overlays, an AI thumbnail
 * and publishing copy. Used to turn a credit number into something a creator
 * can picture. Built from the live catalog, so a reprice moves it too.
 */
export const FINISHED_VIDEO_CREDITS =
  PAID_ACTIONS.expand_idea.credits +
  PAID_ACTIONS.transcribe.credits * 2 +
  PAID_ACTIONS.clean_transcript.credits +
  PAID_ACTIONS.direct_overlays.credits +
  PAID_ACTIONS.design_overlay.credits * 2 +
  PAID_ACTIONS.publish_thumbnail.credits +
  PAID_ACTIONS.publish_caption.credits;

/** Whole finished videos a credit amount covers. */
export function finishedVideos(credits: number): number {
  return Math.floor(Math.max(0, credits) / FINISHED_VIDEO_CREDITS);
}

/** Whole reference videos (a saved Reel or TikTok, transcribed) it covers. */
export function referenceAnalyses(credits: number): number {
  return Math.floor(
    Math.max(0, credits) / PAID_ACTIONS.reference_analysis.credits,
  );
}

/** Price per credit in cents, from a pack's "$19" style label. */
export function centsPerCredit(
  pack: Pick<CreditPack, "credits" | "priceLabel">,
) {
  const dollars = Number(pack.priceLabel.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(dollars) || pack.credits <= 0) return null;
  return (dollars * 100) / pack.credits;
}
