"use client";

import { useCallback, useRef, useState } from "react";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformVideo } from "@/lib/publish/client";
import {
  addVoiceSample,
  VoiceRequestError,
  type VoiceSample,
} from "@/lib/voice/client";

export interface ImportFailure {
  title: string;
  code: string;
}

export interface ImportProgress {
  done: number;
  total: number;
  current: string | null;
}

/**
 * Transcribes picked videos one at a time, so each has the whole request
 * budget and the sheet can say which one it is on.
 */
export function useSampleImport(onSample: (sample: VoiceSample) => void) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const running = useRef(false);

  const run = useCallback(
    async (platform: PublishPlatform, videos: PlatformVideo[]) => {
      if (running.current || videos.length === 0) return 0;
      running.current = true;
      setFailures([]);
      let added = 0;
      const failed: ImportFailure[] = [];
      try {
        for (const [index, video] of videos.entries()) {
          setProgress({
            done: index,
            total: videos.length,
            current: video.title,
          });
          try {
            const result = await addVoiceSample(platform, video);
            onSample(result.sample);
            added += 1;
          } catch (error) {
            const code =
              error instanceof VoiceRequestError ? error.code : "failed";
            failed.push({ title: video.title, code });
            setFailures([...failed]);
            // Out of credits or plan: the rest would fail the same way.
            if (code === "insufficient_credits" || code === "not_entitled")
              break;
          }
        }
        setProgress({
          done: videos.length,
          total: videos.length,
          current: null,
        });
      } finally {
        running.current = false;
      }
      return added;
    },
    [onSample],
  );

  const reset = useCallback(() => {
    setProgress(null);
    setFailures([]);
  }, []);

  return {
    run,
    progress,
    failures,
    busy: progress !== null && progress.current !== null,
    reset,
  };
}
