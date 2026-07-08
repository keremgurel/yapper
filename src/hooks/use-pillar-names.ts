"use client";

import { useEffect, useState } from "react";
import { loadPillars } from "@/lib/inspiration/store";

/** The user's content-pillar names, read from the Inspiration store (localStorage).
 * Hydration-safe: empty on the server render, filled after mount. */
export function usePillarNames(): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    // Client-only store read after mount (localStorage). Server render is [],
    // filled on the client — the standard hydration-safe pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNames(loadPillars().map((p) => p.name));
  }, []);
  return names;
}
