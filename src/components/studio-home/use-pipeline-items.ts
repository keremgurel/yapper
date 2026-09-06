"use client";

import { listContent } from "@/lib/content/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/** Shared Library rows, with errors kept distinct from an empty pipeline. */
export function usePipelineItems(enabled: boolean) {
  return useClientResource(STUDIO_RESOURCE_KEYS.content, enabled, listContent);
}
