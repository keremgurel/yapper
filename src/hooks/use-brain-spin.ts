"use client";

import { useCallback, useState } from "react";
import { spin, type BrainUsed, type SpunIdea } from "@/lib/brain/client";

/** One pull of the slot machine. Holding a pillar means "another one in this",
 * which is the only reel worth holding: the angle and the format are the part
 * the creator wants surprising. */
export function useBrainSpin(): {
  idea: SpunIdea | null;
  /** What the brain gave this pull, for the card to name. */
  used: BrainUsed | null;
  spinning: boolean;
  error: string | null;
  pull: (pillar?: string | null) => Promise<void>;
} {
  const [idea, setIdea] = useState<SpunIdea | null>(null);
  const [used, setUsed] = useState<BrainUsed | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pull = useCallback(async (pillar?: string | null) => {
    setSpinning(true);
    setError(null);
    try {
      const result = await spin(pillar);
      setIdea(result.idea);
      setUsed(result.used);
    } catch {
      setError("That pull did not land. Try again.");
    } finally {
      setSpinning(false);
    }
  }, []);

  return { idea, used, spinning, error, pull };
}
