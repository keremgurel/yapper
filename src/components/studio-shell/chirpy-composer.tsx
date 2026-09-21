"use client";

import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import VoiceWaveform from "@/components/common/voice-waveform";
import { useDictationCaret } from "@/components/ideas/use-dictation-caret";
import {
  durationLabel,
  useRecordingTimer,
} from "@/components/ideas/use-recording-timer";
import { useVoiceCapture } from "@/hooks/use-voice-capture";

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 220;

/**
 * The message box for Chirpy: grows with what is typed or pasted, and takes
 * dictation. While a take runs, the footer becomes the waveform with a stop
 * (drop the words into the box) and a send (finish the take and send it),
 * the same two choices the idea composer offers.
 */
export default function ChirpyComposer({
  focusRequest,
  draft,
  onDraft,
  working,
  placeholder,
  onSend,
}: {
  /** Bumped by the parent whenever the box should take focus. */
  focusRequest: number;
  draft: string;
  onDraft: (value: string) => void;
  working: boolean;
  placeholder: string;
  onSend: (text: string) => void;
}) {
  const composer = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictationCaret(composer, draft, onDraft);
  const {
    phase,
    error,
    stream,
    start,
    stop,
    cancel,
    permissionBlocked,
    canOpenMicrophoneSettings,
    openMicrophoneSettings,
  } = useVoiceCapture();
  const recording = phase === "recording";
  const transcribing = phase === "transcribing";
  const seconds = useRecordingTimer(recording);

  useLayoutEffect(() => {
    const element = composer.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [draft]);

  useEffect(() => {
    if (focusRequest > 0) composer.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (!recording) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancel();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [recording, cancel]);

  /** Ends the take and splices the words in at the caret; null if nothing was heard. */
  const stopDictation = async (): Promise<string | null> => {
    if (!recording) return null;
    return dictation.insert(await stop());
  };

  const toggleVoice = async () => {
    if (working) return;
    if (phase === "idle" && permissionBlocked && canOpenMicrophoneSettings) {
      await openMicrophoneSettings();
    } else if (phase === "idle") await start();
    else if (recording) await stopDictation();
  };

  const submit = async () => {
    if (working || transcribing) return;
    let text = draft;
    if (recording) {
      const inserted = await stopDictation();
      if (inserted === null) return;
      text = inserted;
    }
    if (text.trim()) onSend(text);
  };

  const canSend = !working && !transcribing && (recording || !!draft.trim());

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="p-2.5"
    >
      <div className="bg-card border-border grid grid-rows-[auto_36px] overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-[color:var(--sg-accent)]/30">
        <textarea
          ref={composer}
          name="chirpy-message"
          value={draft}
          rows={1}
          onChange={(event) => onDraft(event.target.value)}
          onSelect={dictation.remember}
          onKeyUp={dictation.remember}
          onBlur={dictation.remember}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            } else if (event.key === "d" && event.metaKey) {
              event.preventDefault();
              void toggleVoice();
            }
          }}
          placeholder={placeholder}
          aria-label="Message Chirpy"
          className="text-foreground placeholder:text-muted-foreground max-h-[220px] min-h-10 resize-none bg-transparent px-2.5 pt-2.5 text-xs leading-relaxed outline-none"
        />
        <div className="text-muted-foreground flex items-center gap-2 px-2 pb-1 text-[10px]">
          {recording ? (
            <>
              <VoiceWaveform
                stream={stream}
                className="text-foreground/85 h-6 min-w-0 flex-1"
              />
              <span className="w-8 shrink-0 text-right text-[11px] tabular-nums">
                {durationLabel(seconds)}
              </span>
              <button
                type="button"
                onClick={() => void stopDictation()}
                aria-label="Stop dictation"
                title="Stop dictation · keeps the words in the box"
                className="bg-muted text-foreground hover:bg-muted/80 grid size-7 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
              >
                <Square className="size-3 fill-current" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate">
                {error ??
                  (transcribing
                    ? "Transcribing…"
                    : "⏎ send · ⇧⏎ new line · ⌘D dictate")}
              </span>
              <button
                type="button"
                onClick={() => void toggleVoice()}
                disabled={transcribing || working}
                aria-label="Dictate"
                title="Dictate (⌘D)"
                className="text-foreground hover:bg-muted grid size-7 shrink-0 place-items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none disabled:opacity-50"
              >
                {transcribing ? (
                  <Loader2
                    className="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Mic className="size-3.5" aria-hidden="true" />
                )}
              </button>
            </>
          )}
          <button
            type="submit"
            aria-label={recording ? "Send what I said" : "Send"}
            disabled={!canSend}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--sg-accent)] text-black transition-opacity focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-30"
          >
            {working ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
