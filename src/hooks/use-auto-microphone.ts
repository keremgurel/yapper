"use client";

import { useEffect, useRef } from "react";

/**
 * Ask for the microphone once, as soon as the practice page is open, so the
 * visitor never has to find a mic button before speaking. The browser shows
 * its own permission prompt. A refusal is left alone: the caller shows a quiet
 * way to try again, and practice still works without recording.
 */
export function useAutoMicrophone(
  micOn: boolean,
  enableMic: () => Promise<void>,
) {
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || micOn) return;
    asked.current = true;
    if (!navigator.mediaDevices?.getUserMedia) return;
    void enableMic();
  }, [micOn, enableMic]);
}
