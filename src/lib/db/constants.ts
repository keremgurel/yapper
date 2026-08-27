/**
 * Free credits granted once at signup: exactly one training feedback, so a new
 * account can see what the coaching is worth before deciding to pay. Keep this
 * equal to TRAINING_FEEDBACK_CREDITS; the whole funnel rests on the first rep
 * being gradeable without a card.
 */
export const WELCOME_CREDITS = 3;

/** Free-tier media storage quota (bytes). */
export const FREE_STORAGE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

/**
 * Largest video accepted by the direct browser-to-R2 upload path.
 *
 * Four GiB matches TikTok's current upload ceiling and remains below R2's
 * single-PUT ceiling. The bytes never pass through the application server, so
 * this must not inherit the much smaller server-processing safety limit.
 */
export const MAX_DIRECT_VIDEO_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4 GiB

/**
 * Bound for workflows that pull an entire clip through a server function.
 * Keep this separate from direct uploads: it protects temporary disk, runtime,
 * and provider costs without preventing creators from storing or publishing a
 * larger finished export through streaming/direct-transfer paths.
 */
export const MAX_SERVER_PROCESSED_VIDEO_BYTES = 250 * 1024 * 1024; // 250 MiB

/** Credit cost per feedback tier, weighted to the provider pipeline used. */
export const FEEDBACK_CREDITS = { audio: 3, video: 5, full: 8 } as const;
export type FeedbackTier = keyof typeof FEEDBACK_CREDITS;

/**
 * Credit cost of one training feedback run: transcription plus a scoring pass
 * plus a coaching pass. Priced at 3 to stay coherent with the rest of the
 * ladder, where a bare transcription already costs 1 and this action is a
 * strict superset of it. The welcome grant matches, so the first rep is free.
 */
export const TRAINING_FEEDBACK_CREDITS = 3;

/** Credit cost per generation action. */
// Hooks are the cheapest call here (a handful of short lines, no long body),
// and the one a creator is meant to re-run until a line lands, so it is priced
// to make "give me three more" an easy click.
export const GENERATE_CREDITS = { idea: 2, script: 3, hooks: 1 } as const;
export type GenerateAction = keyof typeof GENERATE_CREDITS;
