import type { ChipTone } from "@/components/studio-ui/chip-tones";

/**
 * Distribution format, colored from the shared tone vocabulary. Replaces the
 * raw Tailwind class strings in `src/lib/content/formats.ts` (`chip`), whose
 * amber/rose read as the orange accent at chip size; once every chip renders
 * through `Chip` + this map, that field can be deleted.
 */
const FORMAT_TONE: Record<string, ChipTone> = {
  short: "cyan",
  long: "violet",
  article: "pink",
  thread: "yellow",
  carousel: "green",
  newsletter: "neutral",
};

export function formatTone(id: string): ChipTone {
  return FORMAT_TONE[id] ?? "neutral";
}
