"use client";

import { useCallback, useState } from "react";
import type { PostableVideo } from "@/lib/publish/postable-videos";

/**
 * Which videos are being prepared together, and which one the rail is showing.
 * The two move together: opening a video makes it active, toggling it also
 * makes it active, so the rail never describes a video the creator is not
 * looking at.
 */
export function useVideoSelection(videos: PostableVideo[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const toggle = useCallback((video: PostableVideo) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(video.id)) next.delete(video.id);
      else next.add(video.id);
      return next;
    });
    setActiveId(video.id);
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((current) =>
      current.size === videos.length
        ? new Set()
        : new Set(videos.map((video) => video.id)),
    );
  }, [videos]);

  const active =
    videos.find((video) => video.id === activeId) ??
    videos.find((video) => selectedIds.has(video.id)) ??
    videos[0] ??
    null;
  const selected = videos.filter((video) => selectedIds.has(video.id));

  return {
    active,
    selected,
    selectedIds,
    open: setActiveId,
    toggle,
    toggleAll,
  };
}
