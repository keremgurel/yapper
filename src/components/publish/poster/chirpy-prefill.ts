import type { PosterPrefill } from "@/lib/chirpy/studio/poster/prefill";

/**
 * Chirpy's hand-over to Poster: what to fill in for a video, kept until
 * Poster opens that video. The video, and a suggested time, travel in the
 * link (`?item=`, `?scheduleAt=`) the way a Calendar day or the editor opens
 * Poster; captions and platforms wait here.
 */
const pending = new Map<string, PosterPrefill>();
const EVENT = "studio:poster-prefill";

/** Only the latest hand-over waits: one whose video never opened is dropped
 * rather than landing on a later visit. */
export function handPosterPrefill(prefill: PosterPrefill): void {
  pending.clear();
  pending.set(prefill.videoID, prefill);
  window.dispatchEvent(new Event(EVENT));
}

export function takePosterPrefill(videoID: string): PosterPrefill | undefined {
  const prefill = pending.get(videoID);
  pending.delete(videoID);
  return prefill;
}

export function onPosterPrefill(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

let focusID: string | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The library item behind the video open in Poster, so "post this" means
 * it. Poster sets it as the creator opens and closes videos; a channel's own
 * post has no library item and is left out. */
export function setPosterFocus(id: string | undefined): void {
  focusID = id && UUID.test(id) ? id : undefined;
}

export function posterFocus(): string | undefined {
  return focusID;
}

/** Poster's link for a hand-over. `prep` is new each time, so asking for the
 * same video twice opens it again. */
export function posterHref(prefill: PosterPrefill, prep: string): string {
  const query = new URLSearchParams({ item: prefill.videoID, prep });
  if (prefill.scheduleAt) query.set("scheduleAt", prefill.scheduleAt);
  return `/studio/poster?${query}`;
}
