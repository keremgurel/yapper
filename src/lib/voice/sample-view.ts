import type { VoiceSampleRow } from "@/lib/db/voice-samples";

/** What the client sees of a sample. */
export function sampleView(row: VoiceSampleRow) {
  return {
    id: row.id,
    platform: row.platform,
    externalPostId: row.externalPostId,
    url: row.url,
    title: row.title,
    thumbnail: row.thumbnail,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    durationSec: row.durationSec,
    transcript: row.transcript,
    creditsCharged: row.creditsCharged,
    createdAt: row.createdAt.toISOString(),
  };
}
export type VoiceSampleView = ReturnType<typeof sampleView>;
