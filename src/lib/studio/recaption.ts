import { clipDuration, clipTimelineStart } from "@/lib/studio/clips";
import { extractAdmittedMonoPcm } from "@/lib/studio/audio-decode";
import { newWordId, type Clip, type Word } from "@/lib/studio/types";
import type { RawWord } from "@/lib/studio/transcribe-remote";

export const MAX_RECAPTION_DURATION_SECONDS = 600;

export function plannedRecaptionSamples(
  clips: Clip[],
  sampleRate: number,
): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("recaption_invalid_audio");
  }
  let total = 0;
  for (const clip of clips) {
    const duration = clipDuration(clip);
    if (!Number.isFinite(duration) || duration < 0) {
      throw new Error("recaption_invalid_audio");
    }
    total += Math.round(duration * sampleRate);
    if (
      !Number.isSafeInteger(total) ||
      total / sampleRate > MAX_RECAPTION_DURATION_SECONDS
    ) {
      throw new Error("recaption_audio_too_large");
    }
  }
  return total;
}

/**
 * Rebuild only the audible main-track sequence at its native sample rate. The
 * clips may be trimmed or reordered; removed source ranges are never copied.
 */
export async function renderCurrentCutAudio(
  sourceUrl: string,
  clips: Clip[],
  signal?: AbortSignal,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  signal?.throwIfAborted();
  if (clips.some((clip) => clip.src)) {
    throw new Error("recaption_appended_media_unsupported");
  }
  const { samples: source, sampleRate } = await extractAdmittedMonoPcm(
    sourceUrl,
    signal,
  );
  signal?.throwIfAborted();
  const totalSamples = plannedRecaptionSamples(clips, sampleRate);
  const samples = new Float32Array(totalSamples);
  let writeAt = 0;
  for (const clip of clips) {
    signal?.throwIfAborted();
    const from = Math.max(0, Math.round(clip.start * sampleRate));
    const length = Math.max(0, Math.round(clipDuration(clip) * sampleRate));
    const slice = source.subarray(from, Math.min(source.length, from + length));
    samples.set(slice, writeAt);
    writeAt += length;
  }
  return { samples, sampleRate };
}

/**
 * ASR words for the rendered cut use edited-timeline seconds. Convert each one
 * back to the source anchors used by captions, preserving edited-timeline order.
 */
export function editedWordsToSourceWords(
  raw: RawWord[],
  clips: Clip[],
): Word[] {
  const starts = clips.map((_, index) => clipTimelineStart(clips, index));
  return raw.flatMap((word, index) => {
    const midpoint = (word.start + word.end) / 2;
    const clipIndex = clips.findIndex((clip, i) => {
      const start = starts[i];
      return midpoint >= start && midpoint <= start + clipDuration(clip);
    });
    if (clipIndex < 0 || clips[clipIndex].src) return [];
    const clip = clips[clipIndex];
    const timelineStart = starts[clipIndex];
    const start = Math.max(
      clip.start,
      clip.start + Math.max(0, word.start - timelineStart),
    );
    const end = Math.min(
      clip.end,
      clip.start + Math.max(0, word.end - timelineStart),
    );
    if (end <= start) return [];
    return [{ ...word, id: newWordId(index), start, end }];
  });
}
