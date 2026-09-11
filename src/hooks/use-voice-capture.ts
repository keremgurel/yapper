"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeVoiceCapture } from "@/lib/voice/transcribe-capture";
import { invoke, isNative } from "@/lib/studio/native/bridge";
import {
  VoiceCaptureController,
  type VoiceCaptureErrorKind,
  type VoiceCapturePhase,
} from "@/lib/voice/voice-capture-controller";

/**
 * Record a voice note from the mic and transcribe it via /api/transcribe.
 * Exposes the live `stream` while recording so a visualizer can draw the real
 * waveform, plus `cancel` to throw the take away without transcribing.
 */
export function useVoiceCapture() {
  const [phase, setPhase] = useState<VoiceCapturePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<VoiceCaptureErrorKind>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const controllerRef = useRef<VoiceCaptureController | null>(null);

  useEffect(() => {
    const controller = new VoiceCaptureController(
      {
        getUserMedia: () =>
          navigator.mediaDevices.getUserMedia({ audio: true }),
        createRecorder: (mediaStream) => new MediaRecorder(mediaStream),
        transcribe: transcribeVoiceCapture,
      },
      {
        phase: setPhase,
        error: (message, kind) => {
          setError(message);
          setErrorKind(kind);
        },
        stream: setStream,
      },
    );
    controllerRef.current = controller;
    return () => {
      if (controllerRef.current === controller) controllerRef.current = null;
      controller.dispose();
    };
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Voice recording isn't available on this device.");
      setErrorKind("unavailable");
      setPhase("idle");
      return;
    }
    await controllerRef.current?.start();
  }, []);

  const openMicrophoneSettings = useCallback(async (): Promise<boolean> => {
    if (!isNative()) return false;
    try {
      await invoke("open_microphone_settings");
      return true;
    } catch {
      setError(
        "Open System Settings, then allow Yapper Studio to use the microphone.",
      );
      return false;
    }
  }, []);

  /** Stop recording and resolve the transcribed text. */
  const stop = useCallback(async (): Promise<string> => {
    return (await controllerRef.current?.stop()) ?? "";
  }, []);

  /** Throw the recording away without transcribing. */
  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
  }, []);

  return {
    phase,
    error,
    stream,
    start,
    stop,
    cancel,
    permissionBlocked: errorKind === "permission",
    canOpenMicrophoneSettings: isNative(),
    openMicrophoneSettings,
  };
}
