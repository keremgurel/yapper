"use client";

import { useEffect, useRef } from "react";
import type { PostableVideo } from "@/lib/publish/postable-videos";
import { fromPostable, type PosterVideo } from "../poster-video";

/** Open an editor handoff once its video arrives, then leave selection to the
 * user. A new `nonce` (Chirpy's `prep`) asks for the same video again. */
export function useRequestedVideo(
  requested: string | null,
  library: readonly PostableVideo[],
  setActive: (video: PosterVideo) => void,
  nonce: string | null = null,
) {
  const key = requested ? `${requested}:${nonce ?? ""}` : null;
  const handoff = useRef<{ requested: string | null; opened: boolean }>({
    requested: null,
    opened: false,
  });

  useEffect(() => {
    if (handoff.current.requested !== key) {
      handoff.current = { requested: key, opened: false };
    }
    if (!requested || handoff.current.opened) return;
    const video = library.find((candidate) => candidate.id === requested);
    if (!video) return;

    // Consume only after the library contains the export. Refreshes must not
    // reopen it after the user closes it or picks a different video.
    handoff.current.opened = true;
    setActive(fromPostable(video));
  }, [key, requested, library, setActive]);
}
