"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformCaption } from "@/lib/publish/caption-format";
import {
  onPosterPrefill,
  setPosterFocus,
  takePosterPrefill,
} from "./chirpy-prefill";

/**
 * Apply what Chirpy filled in once its video is the open one: captions as if
 * they were just written, the chosen platforms, and a thumbnail prompt.
 * Returns, by video, the thumbnail prompt for the cover studio to start from
 * and the suggested time, which keys the publish sheet so an open sheet reads
 * the new `scheduleAt` link again.
 */
export function usePosterPrefill(
  activeID: string | undefined,
  applyCaptions: (videoId: string, captions: PlatformCaption[]) => void,
  setDestinations: Dispatch<
    SetStateAction<Record<string, Set<PublishPlatform>>>
  >,
): {
  thumbnailPrompts: Record<string, string>;
  scheduleAt: Record<string, string>;
} {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [times, setTimes] = useState<Record<string, string>>({});
  useEffect(() => {
    setPosterFocus(activeID);
    return () => setPosterFocus(undefined);
  }, [activeID]);
  useEffect(() => {
    if (!activeID) return;
    const consume = () => {
      const prefill = takePosterPrefill(activeID);
      if (!prefill) return;
      if (prefill.captions?.length) applyCaptions(activeID, prefill.captions);
      const { platforms, thumbnailPrompt, scheduleAt } = prefill;
      if (platforms?.length)
        setDestinations((current) => ({
          ...current,
          [activeID]: new Set(platforms),
        }));
      if (thumbnailPrompt)
        setPrompts((current) => ({ ...current, [activeID]: thumbnailPrompt }));
      if (scheduleAt)
        setTimes((current) => ({ ...current, [activeID]: scheduleAt }));
    };
    consume();
    return onPosterPrefill(consume);
  }, [activeID, applyCaptions, setDestinations]);
  return { thumbnailPrompts: prompts, scheduleAt: times };
}
