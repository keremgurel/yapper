import type { ChipTone } from "@/components/studio-ui/chip-tones";
import type { ContentStatus } from "@/lib/db/schema";

/** Pipeline status on the shared hue meanings: neutral draft, cyan while in
 * progress, yellow while waiting on a date, green when it shipped. */
const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  drafted: "neutral",
  planned: "cyan",
  scheduled: "yellow",
  posted: "green",
};

export function statusTone(status: ContentStatus): ChipTone {
  return STATUS_TONE[status];
}
