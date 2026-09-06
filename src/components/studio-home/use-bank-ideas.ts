"use client";

import { listIdeas } from "@/lib/ideas/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/** Shared Idea Bank rows, including a recoverable initial load failure. */
export function useBankIdeas(enabled: boolean) {
  return useClientResource(STUDIO_RESOURCE_KEYS.ideas, enabled, listIdeas);
}
