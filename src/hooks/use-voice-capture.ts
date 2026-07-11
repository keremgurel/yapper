"use client";

import { useCallback, useRef, useState } from "react";

type Phase = "idle" | "recording" | "transcribing";

/** Record a short voice note from the mic and transcribe it via /api/transcribe.
 * One responsibility: capture audio → text. Returns the phase plus start/stop;
 * `stop` resolves the transcript (empty string on failure). */
export function useVoiceCapture() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
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

  return { phase, error, start, stop };
}
