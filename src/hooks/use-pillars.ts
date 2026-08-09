"use client";

import { getProject, type Pillar } from "@/lib/project/client";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import { useClientResource } from "@/hooks/use-client-resource";

/**
 * The creator's pillars, for the surfaces that only need to read them (the
 * bulk reclassify menu, filters, the workbench rail). Editing lives in the
 * project brain sheet; this deliberately returns no writer so there is one
 * place pillars change.
 *
 * Served from the shared resource cache. This hook is mounted on the library,
 * the bank and the workbench, so fetching per mount meant a visible cold load
 * on nearly every tab switch in the desktop shell, for data that changes about
 * once a month.
 */
export function usePillars(): { pillars: Pillar[]; loading: boolean } {
  const { data } = useClientResource(
    STUDIO_RESOURCE_KEYS.project,
    true,
    // Filters and the reclassify menu degrade to empty rather than break the
    // table they sit above.
    () => getProject().catch(() => ({ pillars: [] as Pillar[] })),
  );

  return { pillars: data?.pillars ?? [], loading: data === null };
}
