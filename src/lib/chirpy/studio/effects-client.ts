import {
  reloadClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import type { StudioEffect } from "./wire";

/** The web caches each Studio effect covers. The idea list feeds Ideas, the
 * calendar and Poster's picker, so all three reload. */
const RESOURCES: Record<StudioEffect, string[]> = {
  ideas: [
    STUDIO_RESOURCE_KEYS.ideas,
    STUDIO_RESOURCE_KEYS.content,
    STUDIO_RESOURCE_KEYS.posterContent,
  ],
  ideaViews: [STUDIO_RESOURCE_KEYS.views("library")],
  // The project carries the palette too, for generated graphics.
  brand: [STUDIO_RESOURCE_KEYS.brand, STUDIO_RESOURCE_KEYS.project],
  storage: [],
  posterVideos: [STUDIO_RESOURCE_KEYS.posterContent],
  // The calendar polls its schedules instead of caching them, so it listens
  // for SCHEDULES_CHANGED.
  schedules: [],
};

/** Effects whose page the server renders, so the route itself reloads. */
const SERVER_RENDERED: readonly StudioEffect[] = ["storage"];

/** Tells a mounted calendar to read its scheduled posts again. */
export const SCHEDULES_CHANGED = "studio:schedules-changed";

/** Reload whatever a Chirpy turn changed on the server, so an open page shows
 * it without a refresh. `refresh` reloads a server-rendered page. */
export function applyStudioEffects(
  effects: readonly StudioEffect[],
  refresh?: () => void,
): void {
  for (const effect of effects)
    for (const key of RESOURCES[effect] ?? []) reloadClientResource(key);
  if (effects.some((effect) => SERVER_RENDERED.includes(effect))) refresh?.();
  if (effects.includes("schedules"))
    window.dispatchEvent(new Event(SCHEDULES_CHANGED));
}
