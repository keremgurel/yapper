import type { ChipTone } from "@/components/studio-ui/chip-tones";

const PILLAR_TONES: ChipTone[] = ["cyan", "violet", "green", "pink", "yellow"];

/**
 * Pillars store no color, so derive one from the name: hashing (rather than
 * list position) keeps a pillar the same hue on every surface and after
 * reordering. Rendered as the dot variant so five arbitrary pillar hues never
 * collide with the status/format tint chips beside them.
 */
export function pillarTone(name: string): ChipTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PILLAR_TONES[hash % PILLAR_TONES.length];
}
