"use client";

import { Mic, Check, ArrowUp } from "lucide-react";
import VoiceSurface from "@/components/common/voice-surface";

/** A sample dictation display. No microphone access or transcription requests. */
export default function DemoDictation({
  text,
  active,
  processing = false,
  saved = false,
  frame,
  placeholder = "Say what’s on your mind…",
}: {
  text: string;
  active: boolean;
  processing?: boolean;
  saved?: boolean;
  frame: number;
  placeholder?: string;
}) {
  return (
    <VoiceSurface
      active={active || processing}
      processing={processing}
      level={() =>
        active ? 0.25 + Math.abs(Math.sin(performance.now() / 320)) * 0.35 : 0
      }
      className="demo-dictation"
    >
      <p data-empty={!text}>{text || placeholder}</p>
      <div className="demo-dictation-footer">
        {saved ? <Check size={15} /> : <Mic size={15} />}
        <span>
          {saved
            ? "Saved to your ideas"
            : processing
              ? "Organizing your idea…"
              : active
                ? "Listening…"
                : "Voice note"}
        </span>
        <div className="demo-dictation-wave" data-active={active}>
          {Array.from({ length: 20 }, (_, i) => (
            <i
              key={i}
              style={{
                height: active
                  ? `${20 + ((i * 17 + frame * 23) % 80)}%`
                  : "15%",
              }}
            />
          ))}
        </div>
        {!saved && <ArrowUp size={15} />}
      </div>
    </VoiceSurface>
  );
}
