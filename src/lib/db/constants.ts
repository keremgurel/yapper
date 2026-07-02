/** Free credits granted once at signup. Tuned against real COGS in Phase 6. */
export const WELCOME_CREDITS = 3;

/** Free-tier media storage quota (bytes). Enforced at upload in a later phase. */
export const FREE_STORAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/** Credit cost per feedback tier (proportional to COGS; finalized in Billing). */
export const FEEDBACK_CREDITS = { audio: 1, video: 2, full: 3 } as const;
export type FeedbackTier = keyof typeof FEEDBACK_CREDITS;

/** Credit cost per generation action. */
export const GENERATE_CREDITS = { idea: 1, script: 2 } as const;
export type GenerateAction = keyof typeof GENERATE_CREDITS;
