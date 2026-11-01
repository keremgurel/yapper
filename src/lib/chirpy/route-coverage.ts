/**
 * Every API route export that changes something, and how Chirpy reaches it.
 *
 * Chirpy should be able to do whatever a creator can do by hand, so a route a
 * control calls either maps to the registered actions that do the same thing,
 * sits in an exclusion with its reason, or waits in UNCOVERED for its Studio
 * surface's actions. route-coverage.test.ts fails on a mutating export that is
 * in none of these, on an entry whose route is gone, and on an action id the
 * contract does not have. Move a route from UNCOVERED to ROUTE_ACTIONS in the
 * PR that adds its actions; the list only shrinks.
 *
 * Keys are "METHOD /api/path", with dynamic segments as in the folder names.
 */

/** Routes whose effect a registered action produces, through the same
 * operation or as part of a workflow the action runs. */
export const ROUTE_ACTIONS: Record<string, readonly string[]> = {
  "POST /api/ideas": ["studio.ideas.capture"],
  "POST /api/ideas/expand": ["studio.ideas.capture", "studio.ideas.draft"],
  "PATCH /api/content/[id]": [
    "studio.ideas.rename",
    "studio.ideas.setPillar",
    "studio.ideas.schedule",
    "studio.ideas.unschedule",
    "studio.ideas.setScript",
    "studio.ideas.canvasEdit",
  ],
  "DELETE /api/content/[id]": ["studio.ideas.delete"],
  "POST /api/content/bulk": [
    "studio.ideas.setStatus",
    "studio.ideas.setPillar",
    "studio.ideas.delete",
  ],
  "POST /api/content/[id]/versions/[format]/write": [
    "studio.ideas.writeVersion",
  ],
  "DELETE /api/content/[id]/versions/[format]": ["studio.ideas.deleteVersion"],
  "PUT /api/content/[id]/versions/[format]": [
    "studio.ideas.setScript",
    "studio.ideas.canvasEdit",
  ],
  "DELETE /api/content/[id]/messages": ["studio.ideas.clearThread"],
  "POST /api/generate/canvas": ["studio.ideas.canvasEdit"],
  "POST /api/content/capture": ["studio.ideas.capture"],
  "POST /api/ideas/import": ["studio.ideas.import"],
  "POST /api/content/brainstorm": ["studio.inspiration.brainstorm"],
  "POST /api/views": ["studio.ideas.views.create"],
  "PATCH /api/views/[id]": ["studio.ideas.views.update"],
  "DELETE /api/views/[id]": ["studio.ideas.views.delete"],
  "PATCH /api/brand": ["studio.brand.colors"],
  "PATCH /api/brand/logos/[id]": ["studio.brand.logos.makePrimary"],
  "DELETE /api/brand/logos/[id]": ["studio.brand.logos.delete"],
  "DELETE /api/storage/videos": ["studio.storage.removeVideos"],
  "DELETE /api/submissions/[id]": ["studio.storage.deleteRecording"],
  "PUT /api/publish/automations": ["studio.automations.update"],
  "PATCH /api/project": [
    "studio.brain.essentials.update",
    "studio.brain.pillars.save",
    "studio.brain.delete",
    "studio.brain.setup",
  ],
  "POST /api/brain/blocks": [
    "studio.brain.knowledge.add",
    "studio.brain.knowledge.import",
    "studio.brain.setup",
  ],
  "PATCH /api/brain/blocks": ["studio.brain.knowledge.update"],
  "PATCH /api/brain/blocks/[id]": ["studio.brain.knowledge.update"],
  "DELETE /api/brain/blocks/[id]": ["studio.brain.delete"],
  "POST /api/brain/ingest": ["studio.brain.knowledge.import"],
  "POST /api/brain/setup": ["studio.brain.setup"],
  "POST /api/brain/skills": ["studio.brain.skills.save"],
  "PATCH /api/brain/skills": ["studio.brain.skills.save"],
  "PATCH /api/brain/skills/[id]": ["studio.brain.skills.save"],
  "DELETE /api/brain/skills/[id]": ["studio.brain.delete"],
  "POST /api/brain/catalog/[slug]/install": ["studio.brain.catalog.install"],
  "POST /api/brain/voice/samples": ["studio.brain.voice.listen"],
  "DELETE /api/brain/voice/samples/[id]": ["studio.brain.delete"],
  "POST /api/brain/voice/derive": ["studio.brain.voice.derive"],
  "POST /api/transcription-dictionary": ["app.dictionary.addTerm"],
  "PATCH /api/transcription-dictionary/[id]": ["app.dictionary.editTerm"],
  "DELETE /api/transcription-dictionary/[id]": ["app.dictionary.removeTerm"],
  "POST /api/transcribe": ["editor.transcribe"],
  "POST /api/clean-transcript": ["editor.cleanup"],
  "POST /api/design-overlays": ["editor.designOverlays"],
  "POST /api/direct-overlays": ["editor.designOverlays"],
  "POST /api/place-overlays": ["editor.designOverlays"],
  "POST /api/revise-overlay": ["editor.designOverlays"],
  "POST /api/review-overlay": ["editor.designOverlays"],
};

export type ExclusionReason =
  /** Payments and the billing portal: never written by Chirpy. */
  | "billing"
  /** Called by another service, not by a creator. */
  | "webhook"
  /** Platform sign-in and its callbacks. */
  | "oauth"
  /** Byte uploads and the signed URLs for them; the action that uses the
   * file is what Chirpy runs. */
  | "upload"
  /** Chirpy's own endpoints. */
  | "chirpy"
  /** Staff-only tools. */
  | "admin"
  /** Signing a device in. */
  | "auth"
  /** One-time moves of browser storage into the database. */
  | "migration"
  /** A POST that only reads or previews and saves nothing of the creator's. */
  | "read"
  /** No client calls it any more. */
  | "retired"
  /** Posts to a connected platform. Chirpy never publishes or schedules a
   * post itself. */
  | "publish";

export const EXCLUDED_ROUTES: Record<string, ExclusionReason> = {
  "POST /api/billing/checkout": "billing",
  "POST /api/billing/portal": "billing",
  "POST /api/stripe/webhook": "webhook",
  "POST /api/webhooks/clerk": "webhook",
  "DELETE /api/publish/connections/[platform]": "oauth",
  "POST /api/media/upload-url": "upload",
  "POST /api/transcribe/upload-url": "upload",
  "POST /api/submissions": "upload",
  "POST /api/brand/logos": "upload",
  "POST /api/chirpy/plan": "chirpy",
  "POST /api/chirpy/studio": "chirpy",
  "POST /api/chirpy/confirm": "chirpy",
  "POST /api/admin/skills": "admin",
  "PATCH /api/admin/skills/[id]": "admin",
  "DELETE /api/admin/skills/[id]": "admin",
  "POST /api/handoff/phone": "auth",
  "POST /api/content/import": "migration",
  "POST /api/ideas/migrate": "migration",
  "POST /api/inspiration/resolve": "read",
  "POST /api/inspiration/creator": "read",
  "POST /api/publish/preview": "read",
  "POST /api/feedback": "retired",
  // Retrying a failed cross-post copies the video to YouTube or TikTok.
  "POST /api/publish/automations/runs/[id]": "publish",
  // The slot machine that called it has not been mounted since 0c28aac7;
  // banking an idea from the creator's words is studio.ideas.capture.
  "POST /api/brain/spin": "retired",
  // The canvas ask (generate/canvas) writes hooks, scripts and ideas now.
  "POST /api/generate/hooks": "retired",
  "POST /api/generate/script": "retired",
  "POST /api/generate/idea": "retired",
};

/** Routes a creator reaches by hand that have no action yet, by the Studio
 * surface whose PR adds them. */
export const UNCOVERED_ROUTES: Record<string, string> = {
  // Poster and the calendar's publishing schedule.
  "POST /api/content": "poster",
  "POST /api/publish/projects": "poster",
  "POST /api/publish/caption": "poster",
  "POST /api/publish/thumbnail": "poster",
  "DELETE /api/publish/uploads/[id]": "poster",
  "POST /api/publish/youtube": "poster",
  "POST /api/publish/tiktok": "poster",
  "POST /api/publish/tiktok/direct": "poster",
  "POST /api/publish/tiktok/import": "poster",
  "POST /api/publish/instagram": "poster",
  "POST /api/publish/instagram/import": "poster",
  "POST /api/publish/facebook": "poster",
  "POST /api/publish/facebook/pages": "poster",
  "POST /api/publish/schedules": "calendar",
  "PATCH /api/publish/schedules/[id]": "calendar",
};
