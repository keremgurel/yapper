/** What each paid Studio action charges, in credits. Pure data, so client
 * components such as the pricing page can read it without the database. */
export const PAID_ACTIONS = {
  chirpy_plan: { credits: 2, label: "Chirpy action planning" },
  transcribe: { credits: 4, label: "Transcription per three minutes" },
  /** Per three minutes of one of the creator's own videos. */
  voice_sample: { credits: 1, label: "Voice sample transcription" },
  clean_transcript: { credits: 8, label: "AI edit cleanup" },
  place_overlays: { credits: 4, label: "AI media placement" },
  reference_analysis: { credits: 8, label: "Reference analysis" },
  creator_analysis: { credits: 12, label: "Creator feed analysis" },
  capture_idea: { credits: 1, label: "Idea capture" },
  expand_idea: { credits: 8, label: "Idea expansion" },
  brainstorm: { credits: 1, label: "Idea brainstorm" },
  publish_caption: { credits: 1, label: "Publish copy" },
  publish_thumbnail: { credits: 12, label: "AI thumbnail" },
  brain_setup: { credits: 8, label: "Brain setup" },
  ingest_context: { credits: 1, label: "Context import" },
  direct_overlays: { credits: 10, label: "AI overlay planning" },
  design_overlay: { credits: 30, label: "AI overlay design" },
  scene_image: { credits: 6, label: "AI overlay picture" },
  revise_overlay: { credits: 30, label: "AI overlay revision" },
  retime_overlay: { credits: 4, label: "AI overlay retiming" },
} as const;

export type PaidAction = keyof typeof PAID_ACTIONS;
