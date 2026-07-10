"use client";

import { useCallback, useState } from "react";
import { assetFromFile, assetFromSource } from "@/lib/studio/media-asset";
import type { MediaAsset, StudioSource } from "@/lib/studio/types";

/**
 * The project's media library: what you can drop onto a track. It is only a
 * list. Which tracks currently use an asset is the project's business, not the
 * library's, so `dropAsset` hands the removed entry back and lets the caller
 * unpick its placements.
 */
export function useMediaLibrary() {
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);

  /** Add an uploaded file. Files that are neither video nor image are ignored. */
  const addMediaAsset = useCallback(async (file: File) => {
    const asset = await assetFromFile(file);
    if (asset) setMediaAssets((prev) => [...prev, asset]);
  }, []);

  /**
   * Put the recording at the head of the library, once. It is re-addable to any
   * track exactly like an upload; being the thing you recorded buys it nothing.
   */
  const registerSource = useCallback((source: StudioSource) => {
    setMediaAssets((prev) =>
      prev.some((m) => m.url === source.url)
        ? prev
        : [assetFromSource(source), ...prev],
    );
  }, []);

  /** Remove a library entry and return it, or null if it was already gone. */
  const dropAsset = useCallback(
    (id: string): MediaAsset | null => {
      const asset = mediaAssets.find((m) => m.id === id);
      if (!asset) return null;
      setMediaAssets((prev) => prev.filter((m) => m.id !== id));
      return asset;
    },
    [mediaAssets],
  );

  return { mediaAssets, addMediaAsset, registerSource, dropAsset };
}
