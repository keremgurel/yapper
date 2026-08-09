"use client";

import { listIdeas, type ItemSummary } from "@/lib/ideas/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/** Idea Bank inbox rows for the daily suggestions. A fetch error degrades to
 * an empty list so Home falls back to its evergreen starters. */
export function useBankIdeas(enabled: boolean): ItemSummary[] {
  return (
    useClientResource(STUDIO_RESOURCE_KEYS.ideas, enabled, listIdeas).data ?? []
  );
}
