import { clipDuration, clipTimelineStart } from "@/lib/studio/clips";
import { downmixMono } from "@/lib/studio/audio/downmix";
import { extractPcm } from "@/lib/studio/audio/extract-pcm";
import { newWordId, type Clip, type Word } from "@/lib/studio/types";
import type { RawWord } from "@/lib/studio/transcribe-remote";

/**
 * Rebuild only the audible main-track sequence at its native sample rate. The
 * clips may be trimmed or reordered; removed source ranges are never copied.
 */
export async function renderCurrentCutAudio(
  sourceUrl: string,
  clips: Clip[],
): Promise<{ samples: Float32Array; sampleRate: number }> {
  if (clips.some((clip) => clip.src)) {
    throw new Error("recaption_appended_media_unsupported");
  }
  const { channels, sampleRate } = await extractPcm(sourceUrl);
  const source = downmixMono(channels);
  const totalSamples = clips.reduce(
    (sum, clip) =>
      sum + Math.max(0, Math.round(clipDuration(clip) * sampleRate)),
    0,
  );
  const samples = new Float32Array(totalSamples);
  let writeAt = 0;
  for (const clip of clips) {
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
