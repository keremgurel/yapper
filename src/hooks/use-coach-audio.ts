"use client";

import { useCallback, useRef, useState } from "react";

/**
 * A second, deliberately small recording of the microphone only, made in
 * parallel with the real take and used for nothing but AI feedback.
 *
 * The take itself is recorded at 12 Mbps video and 192 kbps audio because the
 * creator may want to keep or publish it. That file blows the feedback route's
 * 4 MB body cap within a few seconds of video, and uploading tens of megabytes
 * to transcribe a one-minute answer would be wasteful even if it fit.
 *
 * Opus at 48 kbps is transparent for speech as far as an ASR model is
 * concerned, and keeps a ten-minute rep comfortably inside the cap.
 */
const COACH_AUDIO_BITS_PER_SECOND = 48_000;

/** Ordered by preference; every entry is on the feedback route's allowlist. */
const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export interface CoachAudio {
  /** The finished audio copy, available once the rep has stopped. */
  blob: Blob | null;
  /**
   * True from the moment recording starts until the blob is ready. The take
   * and this copy are finished by two independent MediaRecorder stop events
   * with no ordering guarantee between them, so the completion screen can be
   * showing the replay while this is still assembling. Without this flag the
   * feedback button reads a null blob and tells someone their mic was off.
   */
  pending: boolean;
  /** Begins the parallel recording. No-op when the mic is off. */
  start: (stream: MediaStream | null) => void;
  stop: () => void;
  reset: () => void;
}

export function useCoachAudio(): CoachAudio {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [pending, setPending] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback((stream: MediaStream | null) => {
    const audioTracks = stream?.getAudioTracks() ?? [];
    // No mic, nothing to coach on. The CTA reads the null blob and says so.
    if (audioTracks.length === 0) return;

    const mimeType = pickMimeType();
    if (!mimeType) return;

    try {
      // A fresh MediaStream over the same track, so this recorder never sees
      // the video track and the two recorders stay independent.
      const recorder = new MediaRecorder(new MediaStream(audioTracks), {
        mimeType,
        audioBitsPerSecond: COACH_AUDIO_BITS_PER_SECOND,
      });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setBlob(
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, { type: mimeType })
            : null,
        );
        chunksRef.current = [];
        setPending(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setPending(true);
    } catch {
      // Feedback is optional; a failure here must never break the take.
      recorderRef.current = null;
      setPending(false);
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      // onstop clears `pending` once the blob exists.
      recorder.stop();
      return;
    }
    setPending(false);
  }, []);

  const reset = useCallback(() => {
    // Detach the handlers BEFORE stopping. A recorder stopped mid-rep still
    // fires dataavailable and onstop a tick later, which would otherwise
    // resurrect `blob` with the take that was just cancelled and write into
    // the chunk buffer a newer recorder is already using.
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    chunksRef.current = [];
    setBlob(null);
    setPending(false);
  }, []);

  return { blob, pending, start, stop, reset };
}
