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
};

/** Reload whatever a Chirpy turn changed on the server, so an open page shows
 * it without a refresh. */
export function applyStudioEffects(effects: readonly StudioEffect[]): void {
  for (const effect of effects)
    for (const key of RESOURCES[effect] ?? []) reloadClientResource(key);
}
