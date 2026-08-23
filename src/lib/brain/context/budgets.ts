import type { BrainSurface } from "@/lib/db/schema";

/**
 * How much prompt each surface spends on the brain.
 *
 * Characters, not tokens, because characters are what we can actually measure
 * without a tokenizer. Roughly four characters to a token.
 *
 * The three numbers are three different jobs. `core` is who the creator is, and
 * it is paid on every call because getting the voice wrong is the expensive
 * mistake. `index` is the one-line summary of everything else they have, which
 * is what lets the model know a keyword table exists without reading it.
 * `loaded` is the part that varies: the skills and sections this particular
 * task selected.
 *
 * The old compiler spent a flat 2400 on everything, always. These are larger
 * where writing happens and smaller where classification happens, which is
 * affordable precisely because nothing is loaded that the task did not ask for.
 */
export interface SurfaceBudget {
  core: number;
  index: number;
  loaded: number;
}

export const SURFACE_BUDGETS: Record<BrainSurface, SurfaceBudget> = {
  // Classification only: which pillar does this belong to. The creator's
  // sections cannot answer that question, so none of them are read.
  capture: { core: 600, index: 0, loaded: 0 },
  caption: { core: 900, index: 400, loaded: 900 },
  hooks: { core: 1200, index: 600, loaded: 1600 },
  ideate: { core: 1400, index: 800, loaded: 2200 },
  expand: { core: 1400, index: 800, loaded: 2600 },
  script: { core: 1400, index: 800, loaded: 2600 },
  // The coach conversation is where a creator asks about their own material, so
  // it sees the most of the index and has the most room to quote from it.
  chat: { core: 1400, index: 1200, loaded: 3000 },
};

export function budgetFor(surface: BrainSurface): SurfaceBudget {
  return SURFACE_BUDGETS[surface] ?? SURFACE_BUDGETS.ideate;
}

/** Caps on how many things one prompt loads in full. A prompt that loaded six
 * skills would be following none of them. */
export const MAX_LOADED_SKILLS = 3;
export const MAX_LOADED_BLOCKS = 3;

/**
 * Below this many routable items, selection is skipped and everything is
 * loaded. Choosing between three sections costs more than reading all three,
 * and it means a creator who just filled in their brain never waits on a router
 * call that had nothing to decide.
 */
export const SELECTION_FLOOR = 4;
