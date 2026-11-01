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
};

/** Effects whose page the server renders, so the route itself reloads. */
const SERVER_RENDERED: readonly StudioEffect[] = ["storage"];

/** Reload whatever a Chirpy turn changed on the server, so an open page shows
 * it without a refresh. `refresh` reloads a server-rendered page. */
export function applyStudioEffects(
  effects: readonly StudioEffect[],
  refresh?: () => void,
): void {
  for (const effect of effects)
    for (const key of RESOURCES[effect] ?? []) reloadClientResource(key);
  if (effects.some((effect) => SERVER_RENDERED.includes(effect))) refresh?.();
}
