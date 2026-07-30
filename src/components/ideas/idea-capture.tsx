"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Mic, Plus, X } from "lucide-react";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import VoiceWaveform from "@/components/common/voice-waveform";

const DRAFT_KEY = "yapper.idea.draft";

/**
 * One box for every kind of idea. Paste a link, type a thought, hold the mic, or
 * all three. The box grows with what you write, the draft survives leaving and
 * coming back, and Cmd/Ctrl+Shift+V toggles the mic from anywhere on the page.
 */
export default function IdeaCapture({
  onCapture,
}: {
  onCapture: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const { phase, error, stream, start, stop, cancel } = useVoiceCapture();

  // Restore an unsent draft on mount, so switching away and back never loses it.
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setText(saved);
  }, []);
  useEffect(() => {
    if (text) localStorage.setItem(DRAFT_KEY, text);
    else localStorage.removeItem(DRAFT_KEY);
  }, [text]);

  // Grow to fit the content (capped), so a long idea is never hidden.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    setText("");
  };

  const recording = phase === "recording";
  const transcribing = phase === "transcribing";

  const toggleVoice = async () => {
    if (phase === "idle") {
      await start();
    } else if (recording) {
      const heard = await stop();
      if (heard) setText((prev) => (prev ? `${prev} ${heard}` : heard));
      ref.current?.focus();
    }
  };

  // Cmd/Ctrl+D toggles the mic (the fastest way to capture an idea).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "d"
      ) {
        e.preventDefault();
        void toggleVoice();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className="border-border bg-card rounded-2xl border p-3 transition-colors focus-within:border-[color:var(--sg-accent)]/60">
      <textarea
        ref={ref}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") submit();
        }}
        placeholder="Drop a link, or type an idea you want to shoot. We preserve the source and break down what actually makes it work."
        rows={2}
        className="text-foreground placeholder:text-muted-foreground/70 max-h-[320px] w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground hidden text-xs sm:block">
          {error ?? "Link, note, or both. ⌘D for voice."}
        </span>
        <div className="flex items-center gap-2">
          {recording && (
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel recording"
              title="Cancel"
              className="border-border text-foreground/55 hover:text-foreground hover:border-foreground/40 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void toggleVoice()}
            disabled={transcribing}
            aria-label={recording ? "Stop recording" : "Record a voice note"}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-bold transition-all ${
              recording
                ? "bg-red-500 text-white shadow-[0_0_0_4px] shadow-red-500/20"
                : "border-border text-foreground/80 hover:bg-muted border"
            }`}
          >
            {transcribing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Transcribing
              </>
            ) : recording ? (
              <>
                <VoiceWaveform stream={stream} className="h-5 w-[120px]" />
                Stop
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Voice
              </>
            )}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 rounded-full bg-[color:var(--sg-accent)] px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Add idea
          </button>
        </div>
      </div>
    </div>
  );
}
