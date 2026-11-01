import {
  reloadClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import type { StudioEffect } from "./wire";

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
  ideaCanvas: [
    STUDIO_RESOURCE_KEYS.ideas,
    STUDIO_RESOURCE_KEYS.content,
    STUDIO_RESOURCE_KEYS.posterContent,
  ],
};

/** Reload whatever a Chirpy turn changed on the server, so an open page shows
 * it without a refresh. */
export function applyStudioEffects(effects: readonly StudioEffect[]): void {
  for (const effect of effects)
    for (const key of RESOURCES[effect] ?? []) reloadClientResource(key);
}
