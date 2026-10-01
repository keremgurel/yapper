/** Shared, client-safe action prices. Server reservations and pricing UI use this catalog. */
export const PAID_ACTIONS = {
  chirpy_plan: { credits: 1, label: "Chirpy action planning" },
  transcribe: { credits: 2, label: "Transcription" },
  /** Per three minutes of one of the creator's own videos. */
  voice_sample: { credits: 1, label: "Voice sample transcription" },
  clean_transcript: { credits: 3, label: "AI edit cleanup" },
  place_overlays: { credits: 1, label: "AI media placement" },
  reference_analysis: { credits: 2, label: "Reference analysis" },
  creator_analysis: { credits: 4, label: "Creator feed analysis" },
  capture_idea: { credits: 2, label: "Idea capture" },
  expand_idea: { credits: 2, label: "Idea expansion" },
  brainstorm: { credits: 1, label: "Idea brainstorm" },
  publish_caption: { credits: 2, label: "Publish copy" },
  publish_thumbnail: { credits: 20, label: "AI thumbnail" },
  ingest_context: { credits: 1, label: "Context import" },
  direct_overlays: { credits: 1, label: "AI overlay planning" },
  design_overlay: { credits: 2, label: "AI overlay design" },
  scene_image: { credits: 2, label: "AI overlay picture" },
  revise_overlay: { credits: 2, label: "AI overlay revision" },
  retime_overlay: { credits: 1, label: "AI overlay retiming" },
} as const;

/** Duration is rounded once per submitted source, never per transport chunk. */
export function transcriptionUnits(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600)
    throw new RangeError("invalid_audio_duration");
  return Math.max(1, Math.ceil(seconds / 60));
}
export function cleanupUnits(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new RangeError("invalid_transcript_duration");
  return Math.max(1, Math.ceil(seconds / 300));
}
