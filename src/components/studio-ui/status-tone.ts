import type { ChipTone } from "@/components/studio-ui/chip-tones";
import type { ContentStatus } from "@/lib/db/schema";

/** Status on the shared hue meanings: neutral for a raw capture, cyan while
 * being drafted, yellow while ready and waiting to be shot or posted, green
 * when it shipped. */
const STATUS_TONE: Record<ContentStatus, ChipTone> = {
  captured: "neutral",
  drafting: "cyan",
  ready: "yellow",
  posted: "green",
};

export function statusTone(status: ContentStatus): ChipTone {
  return STATUS_TONE[status];
}
