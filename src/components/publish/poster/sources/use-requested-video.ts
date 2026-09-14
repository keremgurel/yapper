"use client";

import { useEffect, useRef } from "react";
import type { PostableVideo } from "@/lib/publish/postable-videos";
import { fromPostable, type PosterVideo } from "../poster-video";

/** Open an editor handoff once its video arrives, then leave selection to the user. */
export function useRequestedVideo(
  requested: string | null,
  library: readonly PostableVideo[],
  setActive: (video: PosterVideo) => void,
) {
  const handoff = useRef<{ requested: string | null; opened: boolean }>({
    requested: null,
    opened: false,
  });

  useEffect(() => {
    if (handoff.current.requested !== requested) {
      handoff.current = { requested, opened: false };
    }
    if (!requested || handoff.current.opened) return;
    const video = library.find((candidate) => candidate.id === requested);
    if (!video) return;

    // Consume only after the library contains the export. Refreshes must not
    // reopen it after the user closes it or picks a different video.
    handoff.current.opened = true;
    setActive(fromPostable(video));
  }, [requested, library, setActive]);
}
