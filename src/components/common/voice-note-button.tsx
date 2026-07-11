"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useVoiceCapture } from "@/hooks/use-voice-capture";

/** Tap to record a voice note; tap again to stop. On stop it transcribes and
 * hands the text back via onText (appended to whatever's already there). */
export default function VoiceNoteButton({
  onText,
}: {
  onText: (text: string) => void;
}) {
  const { phase, error, start, stop } = useVoiceCapture();

  const toggle = async () => {
    if (phase === "idle") {
      await start();
    } else if (phase === "recording") {
      const text = await stop();
      if (text) onText(text);
    }
  };

  const recording = phase === "recording";
  const transcribing = phase === "transcribing";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={transcribing}
      aria-label={recording ? "Stop recording" : "Record a voice note"}
      title={error ?? (recording ? "Stop" : "Record a voice note")}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold transition-colors ${
        recording
          ? "border-transparent bg-red-500 text-white"
          : "border-border text-foreground/70 hover:bg-muted hover:text-foreground"
      }`}
    >
      {transcribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {transcribing ? "Transcribing…" : recording ? "Stop" : "Voice"}
    </button>
  );
}
