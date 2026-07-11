"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_ASPECT_ID,
  resolveAspect,
  type AspectId,
} from "@/lib/studio/aspect";
import type { StudioSource } from "@/lib/studio/types";

/**
 * The project's frame shape, chosen by the user. Kept off the bottom track on
 * purpose: deleting or swapping that track must never resize the export.
 */
export function useProjectAspect(source: StudioSource | null) {
  const [aspectId, setAspectId] = useState<AspectId>(DEFAULT_ASPECT_ID);
  const aspect = useMemo(
    () => resolveAspect(aspectId, source),
    [aspectId, source],
  );
  return { aspectId, aspect, setAspectId };
}
