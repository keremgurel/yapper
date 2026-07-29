"use client";

import { useCallback, useRef, useState } from "react";

type Phase = "idle" | "recording" | "transcribing";

/**
 * Record a short voice note from the mic and transcribe it via /api/transcribe.
 * Exposes the live `stream` while recording so a visualizer can draw the real
 * waveform, plus `cancel` to throw the take away without transcribing.
 */
export function useVoiceCapture() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      setStream(s);
      chunksRef.current = [];
      const recorder = new MediaRecorder(s);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setPhase("recording");
    } catch {
      setError("Mic access denied");
      setPhase("idle");
    }
  }, []);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    recorderRef.current = null;
  }, []);

  /** Stop recording and resolve the transcribed text. */
  const stop = useCallback(async (): Promise<string> => {
    const recorder = recorderRef.current;
    if (!recorder) return "";

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.stop();
    });
    cleanup();

    if (blob.size === 0) {
      setPhase("idle");
      return "";
    }

    setPhase("transcribing");
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/webm" },
        body: await blob.arrayBuffer(),
      });
      if (!res.ok) throw new Error("transcribe_failed");
      const data = (await res.json()) as { words?: { text: string }[] };
      const text = (data.words ?? [])
        .map((w) => w.text)
        .join(" ")
        .trim();
      setPhase("idle");
      return text;
    } catch {
      setError("Couldn't transcribe");
      setPhase("idle");
      return "";
    }
  }, [cleanup]);

  /** Throw the recording away without transcribing. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // already stopped
      }
    }
    chunksRef.current = [];
    cleanup();
    setError(null);
    setPhase("idle");
  }, [cleanup]);

  return { phase, error, stream, start, stop, cancel };
}
