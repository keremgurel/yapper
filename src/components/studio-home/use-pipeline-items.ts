"use client";

import { listContent, type ContentSummary } from "@/lib/content/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/** Content Library (pipeline) rows. `null` while loading; an error settles to
 * an empty list rather than a skeleton that never resolves. */
export function usePipelineItems(enabled: boolean): ContentSummary[] | null {
  return useClientResource(STUDIO_RESOURCE_KEYS.content, enabled, listContent)
    .data;
}
