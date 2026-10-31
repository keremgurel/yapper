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
  "POST /api/views": ["studio.ideas.views.create"],
  "PATCH /api/views/[id]": ["studio.ideas.views.update"],
  "DELETE /api/views/[id]": ["studio.ideas.views.delete"],
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
  | "retired";

export const EXCLUDED_ROUTES: Record<string, ExclusionReason> = {
  "POST /api/billing/checkout": "billing",
  "POST /api/billing/portal": "billing",
  "POST /api/stripe/webhook": "webhook",
  "POST /api/webhooks/clerk": "webhook",
  "DELETE /api/publish/connections/[platform]": "oauth",
  "POST /api/media/upload-url": "upload",
  "POST /api/transcribe/upload-url": "upload",
  "POST /api/submissions": "upload",
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
};

/** Routes a creator reaches by hand that have no action yet, by the Studio
 * surface whose PR adds them. */
export const UNCOVERED_ROUTES: Record<string, string> = {
  // Ideas: the canvas (one ask edits the document), its thread and imports.
  "PUT /api/content/[id]/versions/[format]": "ideas canvas",
  "DELETE /api/content/[id]/messages": "ideas canvas",
  "POST /api/generate/canvas": "ideas canvas",
  "POST /api/generate/hooks": "ideas canvas",
  "POST /api/generate/script": "ideas canvas",
  "POST /api/generate/idea": "ideas canvas",
  "POST /api/content/brainstorm": "ideas canvas",
  "POST /api/content/capture": "ideas import",
  "POST /api/ideas/import": "ideas import",
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
  // Brain.
  "POST /api/brain/ask": "brain",
  "PATCH /api/brain/blocks": "brain",
  "POST /api/brain/blocks": "brain",
  "PATCH /api/brain/blocks/[id]": "brain",
  "DELETE /api/brain/blocks/[id]": "brain",
  "POST /api/brain/catalog/[slug]/install": "brain",
  "POST /api/brain/ingest": "brain",
  "POST /api/brain/setup": "brain",
  "PATCH /api/brain/skills": "brain",
  "POST /api/brain/skills": "brain",
  "PATCH /api/brain/skills/[id]": "brain",
  "DELETE /api/brain/skills/[id]": "brain",
  "POST /api/brain/spin": "brain",
  "POST /api/brain/voice/derive": "brain",
  "POST /api/brain/voice/samples": "brain",
  "DELETE /api/brain/voice/samples/[id]": "brain",
  "PATCH /api/project": "brain",
  // Brand.
  "PATCH /api/brand": "brand",
  "POST /api/brand/logos": "brand",
  "PATCH /api/brand/logos/[id]": "brand",
  "DELETE /api/brand/logos/[id]": "brand",
  // Automations.
  "PUT /api/publish/automations": "automations",
  "POST /api/publish/automations/runs/[id]": "automations",
  // Storage.
  "DELETE /api/storage/videos": "storage",
  "DELETE /api/submissions/[id]": "storage",
};
