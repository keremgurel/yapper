import type { ChipTone } from "@/components/studio-ui";
import type { BrainBlockUsage } from "@/lib/db/schema";

/**
 * How the four usage levels are named and coloured, in one place.
 *
 * The words matter more than usual here. "In context" was a checkbox that told
 * a creator nothing about what it cost, and the whole reason the brain can now
 * hold a five thousand row export is that not everything is read every time.
 * These labels say which of the three things is happening: always read, read
 * when relevant, read on request, never read.
 *
 * Tones follow the colour semantics: green for healthy and always on, cyan for
 * informational, neutral for the inactive default, yellow for the one that is
 * deliberately held back.
 */
export interface UsageMeta {
  value: BrainBlockUsage;
  label: string;
  /** One line, for the picker. */
  help: string;
  tone: ChipTone;
}

export const USAGE_LEVELS: UsageMeta[] = [
  {
    value: "core",
    label: "Always",
    help: "Read on every piece of writing. Keep this for who you are, not for reference material.",
    tone: "green",
  },
  {
    value: "auto",
    label: "When relevant",
    help: "Summarised in every prompt, read in full when what you are writing is about it.",
    tone: "cyan",
  },
  {
    value: "manual",
    label: "On request",
    help: "Kept back until you ask for it by name.",
    tone: "neutral",
  },
  {
    value: "private",
    label: "Private",
    help: "Never leaves this page. Yours to read, not the model's.",
    tone: "yellow",
  },
];

export function usageMeta(usage: BrainBlockUsage): UsageMeta {
  return USAGE_LEVELS.find((level) => level.value === usage) ?? USAGE_LEVELS[1];
}

/** Compact size, for the right-hand end of a row. Characters are what the
 * budget is actually measured in, so that is what is shown. */
export function sizeLabel(chars: number): string {
  if (chars < 1_000) return `${chars}`;
  return `${(chars / 1_000).toFixed(chars < 10_000 ? 1 : 0)}k`;
}
