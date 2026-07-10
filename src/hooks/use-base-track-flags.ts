"use client";

import { useCallback, useState } from "react";

/**
 * Hide / mute state for the bottom video track. It is an ordinary track: the
 * only thing that makes it the bottom one is that it renders under everything
 * else, so it carries exactly the same flags every upper track carries.
 */
export function useBaseTrackFlags() {
  const [hidden, setHidden] = useState(false);
  const [muted, setMuted] = useState(false);

  const toggleHidden = useCallback(() => setHidden((v) => !v), []);
  const toggleMuted = useCallback(() => setMuted((v) => !v), []);
  const resetFlags = useCallback(() => {
    setHidden(false);
    setMuted(false);
  }, []);

  return { hidden, muted, toggleHidden, toggleMuted, resetFlags };
}
