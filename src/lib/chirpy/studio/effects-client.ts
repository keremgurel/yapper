import {
  reloadClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import type { StudioEffect } from "./wire";

/** The Automations tab reloads its rule on this event. */
export const AUTOMATIONS_CHANGED = "studio:automations-changed";

/** The web caches each Studio effect covers. The idea list feeds Ideas, the
 * calendar and Poster's picker, so all three reload. A canvas edit reloads
 * them too (its title and date show there); the canvas page itself reads
 * the document fresh when it opens. */
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
  automations: [],
  brain: [STUDIO_RESOURCE_KEYS.project, STUDIO_RESOURCE_KEYS.brain],
  ideaCanvas: [
    STUDIO_RESOURCE_KEYS.ideas,
    STUDIO_RESOURCE_KEYS.content,
    STUDIO_RESOURCE_KEYS.posterContent,
  ],
};

/** Effects whose page the server renders, so the route itself reloads. */
const SERVER_RENDERED: readonly StudioEffect[] = ["storage"];

/** Effects whose page keeps its own state and listens for this event. */
const EVENTS: Partial<Record<StudioEffect, string>> = {
  automations: AUTOMATIONS_CHANGED,
};

/** Reload whatever a Chirpy turn changed on the server, so an open page shows
 * it without a refresh. `refresh` reloads a server-rendered page. */
export function applyStudioEffects(
  effects: readonly StudioEffect[],
  refresh?: () => void,
): void {
  for (const effect of effects)
    for (const key of RESOURCES[effect] ?? []) reloadClientResource(key);
  if (effects.some((effect) => SERVER_RENDERED.includes(effect))) refresh?.();
  for (const effect of effects) {
    const event = EVENTS[effect];
    if (event) window.dispatchEvent(new Event(event));
  }
}
