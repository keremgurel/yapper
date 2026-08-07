"use client";

import { useEffect, useState } from "react";
import { getProject, type Pillar } from "@/lib/project/client";

/**
 * The creator's pillars, for the surfaces that only need to read them (the
 * bulk reclassify menu, filters). Editing lives in the project brain sheet;
 * this deliberately returns no writer so there is one place pillars change.
 */
export function usePillars(): { pillars: Pillar[]; loading: boolean } {
  const [pillars, setPillars] = useState<Pillar[] | null>(null);

  useEffect(() => {
    let active = true;
    getProject().then(
      (payload) => {
        if (active) setPillars(payload.pillars);
      },
      () => {
        // Filters and the reclassify menu degrade to empty rather than break
        // the table they sit above.
        if (active) setPillars([]);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return { pillars: pillars ?? [], loading: pillars === null };
}
