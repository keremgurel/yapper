"use client";

import { getProject } from "@/lib/project/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";
import { brainStarted } from "@/components/studio-home/setup-steps";

/** Whether the creator has told the Brain anything yet. Null while unknown,
 * including when the project failed to load, so Home never nags on a guess. */
export function useBrainStarted(enabled: boolean): boolean | null {
  const { data } = useClientResource(
    STUDIO_RESOURCE_KEYS.project,
    enabled,
    getProject,
  );
  return data ? brainStarted(data) : null;
}
