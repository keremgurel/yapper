/**
 * Which Surplus key a call spends from.
 *
 * Surplus reports spend per key, so one key per product area is what lets the
 * dashboard answer "what did editing cost this month" without reading logs.
 * Each area reads its own variable and falls back to `SURPLUS_API_KEY`, so an
 * area with no key of its own keeps working on the shared one.
 *
 * The Brain's model router (`brain/context/select-model.ts`) runs ahead of
 * most generation calls and always spends from the `brain` key, whichever
 * area asked.
 */
export const SURPLUS_KEY_ENV = {
  /** 1-Click Edit cleanup and overlay placement. */
  editing: "SURPLUS_API_KEY_EDITING",
  /** Overlay planning, design, revision, retiming and render review. */
  overlays: "SURPLUS_API_KEY_OVERLAYS",
  /** Idea capture, brainstorm, scripts, hooks, canvas and idea versions. */
  ideas: "SURPLUS_API_KEY_IDEAS",
  /** Brain setup, ingest, spin, memory, voice and saved references. */
  brain: "SURPLUS_API_KEY_BRAIN",
  /** Chirpy action planning in the editor and in Studio. */
  chirpy: "SURPLUS_API_KEY_CHIRPY",
  /** Publish copy and AI thumbnails. */
  publishing: "SURPLUS_API_KEY_PUBLISHING",
  /** Recorded take coaching. */
  feedback: "SURPLUS_API_KEY_FEEDBACK",
} as const;

export type SurplusKeyScope = keyof typeof SURPLUS_KEY_ENV;

/** The key for an area, or the shared key when the area has none. */
export function surplusKey(scope: SurplusKeyScope): string | undefined {
  return (
    process.env[SURPLUS_KEY_ENV[scope]] ||
    process.env.SURPLUS_API_KEY ||
    undefined
  );
}
