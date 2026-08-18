import type { ChipTone } from "@/components/studio-ui";
import type { CorrectionType } from "@/lib/training-feedback/types";

/**
 * Tones drawn from the shared chip vocabulary so the transcript marks, the
 * legend and the detail card all agree in both themes. Every hue keeps its
 * documented meaning (design language section 5): yellow is the problems hue,
 * so grammar, vocabulary and phrasing all take it; clarity stays cyan
 * (informational); filler stays neutral because the fix is deletion. Five
 * types collapse to three visual classes on purpose; the chip label, not the
 * hue, tells the types apart.
 */
export const CORRECTION_TONES: Record<CorrectionType, ChipTone> = {
  grammar: "yellow",
  vocabulary: "yellow",
  phrasing: "yellow",
  filler: "neutral",
  clarity: "cyan",
};

export const CORRECTION_LABELS: Record<CorrectionType, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  phrasing: "Phrasing",
  filler: "Filler",
  clarity: "Clarity",
};
