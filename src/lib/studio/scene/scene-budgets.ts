/**
 * Completion budgets for the overlay passes.
 *
 * These caps count the model's thinking as well as its answer. The passes run
 * on claude-opus-4.7 through the gateway, which does not pass a reasoning
 * budget on to Claude, so the model decides how long to think and the cap is
 * the only limit. On 4 November 2026 the PostHog generation events showed
 * where the old caps went:
 *
 *   design (8,000):        7 of 8 calls hit the cap, 7,770 to 8,000 of it
 *                          reasoning, 0 to 230 tokens of scene
 *   direct review (4,000): hit the cap with all 4,000 reasoning
 *   render review (1,200): hit the cap with all 1,200 reasoning
 *
 * A capped call fails closed ("answer_truncated"), and asking for a more
 * concise scene does not help when the scene was never started. The caps
 * below leave room for that thinking plus the largest answer each pass
 * writes, and the timeouts allow for it at the ~195 tokens a second the
 * gateway delivered.
 */
export const SCENE_BUDGETS = {
  /** One scene design, restyle or repair. Successful designs used up to
   * ~5,750 tokens, about 850 of them scene. */
  design: { maxCompletionTokens: 16_000, attemptTimeoutMs: 120_000 },
  /** The editorial draft and its review. Drafts used up to ~2,300 tokens. */
  direct: { maxCompletionTokens: 10_000, draftTimeoutMs: 60_000 },
  /** The composited-frame review: a short verdict after a long look. */
  renderReview: { maxCompletionTokens: 6_000, timeoutMs: 55_000 },
  /** Turning a revision sentence into operations. */
  revisionPlan: { maxCompletionTokens: 6_000, timeoutMs: 45_000 },
} as const;
