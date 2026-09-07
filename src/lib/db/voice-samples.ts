import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "./client";
import {
  voiceSamples,
  type PublishPlatform,
  type VoiceSampleStatus,
} from "./schema";

export type VoiceSampleRow = typeof voiceSamples.$inferSelect;

export interface VoiceSampleInput {
  projectId: string;
  userId: string;
  platform: PublishPlatform;
  externalPostId: string;
  url: string;
  title: string;
  thumbnail: string | null;
  publishedAt: Date | null;
  durationSec: number | null;
  transcript: string;
  status: VoiceSampleStatus;
  creditsCharged: number;
  error: string | null;
}

/** How much of one sample the brain quotes back as an example. */
export const VOICE_EXCERPT_CHARS = 700;
/** How many samples the derivation reads. Newest first. */
export const DERIVE_SAMPLE_LIMIT = 8;

export async function listVoiceSamples(
  projectId: string,
): Promise<VoiceSampleRow[]> {
  return getDb()
    .select()
    .from(voiceSamples)
    .where(eq(voiceSamples.projectId, projectId))
    .orderBy(desc(voiceSamples.createdAt));
}

/** Adds a sample, or replaces the earlier attempt at the same video. */
export async function upsertVoiceSample(
  input: VoiceSampleInput,
): Promise<VoiceSampleRow> {
  const [row] = await getDb()
    .insert(voiceSamples)
    .values(input)
    .onConflictDoUpdate({
      target: [
        voiceSamples.projectId,
        voiceSamples.platform,
        voiceSamples.externalPostId,
      ],
      set: {
        url: input.url,
        title: input.title,
        thumbnail: input.thumbnail,
        publishedAt: input.publishedAt,
        durationSec: input.durationSec,
        transcript: input.transcript,
        status: input.status,
        creditsCharged: input.creditsCharged,
        error: input.error,
        createdAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function deleteVoiceSample(
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await getDb()
    .delete(voiceSamples)
    .where(and(eq(voiceSamples.id, id), eq(voiceSamples.userId, userId)))
    .returning({ id: voiceSamples.id });
  return deleted.length > 0;
}

/** The transcripts the voice is derived from, newest first. */
export async function readyVoiceTranscripts(
  projectId: string,
  limit = DERIVE_SAMPLE_LIMIT,
): Promise<{ title: string; transcript: string }[]> {
  const rows = await getDb()
    .select({ title: voiceSamples.title, transcript: voiceSamples.transcript })
    .from(voiceSamples)
    .where(
      and(
        eq(voiceSamples.projectId, projectId),
        eq(voiceSamples.status, "ready"),
        ne(voiceSamples.transcript, ""),
      ),
    )
    .orderBy(desc(voiceSamples.createdAt))
    .limit(limit);
  return rows;
}

/** The opening of the newest sample, for the brain to quote as an example. */
export async function latestVoiceExcerpt(projectId: string): Promise<string> {
  const [row] = await readyVoiceTranscripts(projectId, 1);
  return row ? row.transcript.trim().slice(0, VOICE_EXCERPT_CHARS) : "";
}
