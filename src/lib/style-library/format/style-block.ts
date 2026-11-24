import type { StyleRequest } from "./style-variant";

/**
 * A style in use: which entry, what was changed on it, and which blocks fill
 * its slots. Plain JSON, so a template, a saved variant, a Chirpy action and a
 * connector tool all pass the same thing around.
 */
export interface StyleBlock extends StyleRequest {
  /** Blocks in this style's slots, by slot name. `null` leaves a slot empty. */
  slots?: Record<string, StyleBlock | null>;
}
