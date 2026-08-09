"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import LinkHighlightOverlay, {
  COMPOSER_TEXT_CLASSES,
} from "@/components/ideas/link-highlight-overlay";
import { linkEndingAt, linksIn } from "@/lib/inspiration/link-spans";
import { useCaptureDraft } from "@/components/ideas/use-capture-draft";
import {
  durationLabel,
  useRecordingTimer,
} from "@/components/ideas/use-recording-timer";
import { useDictationCaret } from "@/components/ideas/use-dictation-caret";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import VoiceWaveform from "@/components/common/voice-waveform";

/**
 * The hero of the bank: one field a creator can dump a thought into with zero
 * clicks. Focused on mount, submits on Cmd+Enter, dictates on Cmd+D, and links
 * become a visual attachment instead of polluting the writing surface.
 */
export default function IdeaCapture({
  onCapture,
}: {
  onCapture: (text: string) => void | Promise<void>;
}) {
  const draft = useCaptureDraft();
  const ref = useRef<HTMLTextAreaElement>(null);
  /// The link Backspace has taken hold of, waiting for the second press.
  const [armedLink, setArmedLink] = useState<string | null>(null);

  /**
   * Backspace against a link takes the whole thing, in two presses.
   *
   * A link is one thing to a reader and forty characters to a textarea, so
   * plain Backspace dismantles it into rubble one character at a time — and a
   * half-eaten URL is neither a link nor prose. The first press selects it and
   * marks it, which is the confirmation; the second deletes it. Anywhere else
   * Backspace is exactly Backspace.
   */
  const handleBackspace = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Backspace") {
      setArmedLink(null);
      return;
    }
    const field = event.currentTarget;
    if (field.selectionStart !== field.selectionEnd) {
      setArmedLink(null);
      return;
    }
    const span = linkEndingAt(draft.text, field.selectionStart ?? 0);
    if (!span) {
      setArmedLink(null);
      return;
    }
    event.preventDefault();
    if (armedLink === span.text) {
      draft.updateText(
        draft.text.slice(0, span.start) + draft.text.slice(span.end),
      );
      setArmedLink(null);
      requestAnimationFrame(() => {
        field.setSelectionRange(span.start, span.start);
      });
      return;
    }
    setArmedLink(span.text);
    field.setSelectionRange(span.start, span.end);
  };
  const dictation = useDictationCaret(ref, draft.text, draft.updateText);
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
  const recordingSeconds = useRecordingTimer(recording);
  const canSubmit = Boolean(draft.text.trim() || draft.link || recording);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    // Collapsed to one line at rest; grows with what is typed, capped so a
    // long note scrolls inside the composer instead of taking the page.
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 28), 320)}px`;
  }, [draft.text, draft.link]);

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

  /** Resolves the composer's full text once the take has been spliced in, or
   * null if nothing was heard. */
  const finishRecording = async (): Promise<string | null> => {
    if (!recording) return null;
    const heard = await stop();
    return dictation.insert(heard);
  };

  const submit = async () => {
    let words = draft.text;
    if (recording) {
      // Sending mid-take means "include what I just said". A failed or silent
      // take returns null, and the draft is deliberately left alone: dropping
      // the creator's words and clearing the composer anyway is the one
      // outcome that loses work.
      const inserted = await finishRecording();
      if (inserted === null) return;
      words = inserted;
    }
    // The links are already in the words, where they were typed.
    const capture = words.trim();
    if (!capture) return;
    onCapture(capture);
    draft.clear();
  };

  const toggleVoice = async () => {
    if (phase === "idle" && permissionBlocked && canOpenMicrophoneSettings) {
      await openMicrophoneSettings();
    } else if (phase === "idle") await start();
    else if (recording) await finishRecording();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        void toggleVoice();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The shortcut deliberately follows the current recorder phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("text/uri-list"))
          event.preventDefault();
      }}
      onDrop={(event) => {
        const dropped =
          event.dataTransfer.getData("text/uri-list") ||
          event.dataTransfer.getData("text/plain");
        if (!linksIn(dropped).length) return;
        event.preventDefault();
        // Dropped where the writing is, not into a slot underneath it.
        draft.updateText(
          draft.text
            ? `${draft.text.trimEnd()} ${dropped.trim()}`
            : dropped.trim(),
        );
      }}
      className="sg-glass focus-within:border-foreground/25 p-2.5 transition-[border-color,box-shadow] duration-200 focus-within:shadow-md"
    >
      {/* The links are painted a layer down, in the same metrics, so they can
          look like links while this stays an ordinary textarea. See
          LinkHighlightOverlay. */}
      <div className="relative">
        <LinkHighlightOverlay text={draft.text} armedLink={armedLink} />
        <textarea
          ref={ref}
          value={draft.text}
          autoFocus
          onChange={(event) => {
            draft.updateText(event.target.value);
            setArmedLink(null);
            dictation.remember();
          }}
          onSelect={dictation.remember}
          onKeyUp={dictation.remember}
          onClick={() => {
            setArmedLink(null);
            dictation.remember();
          }}
          onBlur={() => {
            setArmedLink(null);
            dictation.remember();
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
              return;
            }
            handleBackspace(event);
          }}
          placeholder="Capture a thought, paste a reference, or ask Chirpy for ideas…"
          rows={1}
          aria-label="Capture an idea"
          className={`${COMPOSER_TEXT_CLASSES} caret-foreground placeholder:text-muted-foreground/75 relative resize-none bg-transparent text-transparent outline-none`}
        />
      </div>

      <div className="flex min-h-11 items-end gap-2 px-1 pb-0.5">
        <div className="min-w-0 flex-1">
          {recording ? (
            <div className="animate-in fade-in flex h-10 items-center gap-3 pl-2 duration-200">
              {/* The waveform IS the full-width element: its own quiet columns
                  render as the dotted trail, so no filler rule is needed. */}
              <VoiceWaveform
                stream={stream}
                className="text-foreground/85 h-9 min-w-0 flex-1"
              />
              <span className="text-muted-foreground w-9 shrink-0 text-right text-sm tabular-nums">
                {durationLabel(recordingSeconds)}
              </span>
            </div>
          ) : (
            <div
              aria-live="polite"
              className="flex min-h-10 min-w-0 items-center justify-end gap-2"
            >
              <p className="text-muted-foreground min-w-0 truncate text-xs">
                {error ??
                  (transcribing
                    ? "Transcribing your thought…"
                    : "⌘D to dictate · ⌘Enter to bank it")}
              </p>
              {error && (
                <button
                  type="button"
                  onClick={() =>
                    void (permissionBlocked && canOpenMicrophoneSettings
                      ? openMicrophoneSettings()
                      : start())
                  }
                  className="border-border bg-card text-foreground hover:bg-muted shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
                >
                  {permissionBlocked && canOpenMicrophoneSettings
                    ? "Open settings"
                    : "Try again"}
                </button>
              )}
            </div>
          )}
        </div>

        {recording ? (
          <button
            type="button"
            onClick={() => void finishRecording()}
            aria-label="Stop dictating"
            title="Stop dictating"
            className="bg-muted text-foreground hover:bg-muted/80 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void toggleVoice()}
            disabled={transcribing}
            aria-label="Dictate an idea"
            title="Dictate an idea (⌘D)"
            className="text-foreground hover:bg-muted grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none disabled:opacity-50"
          >
            {transcribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        )}

        {/* The one accent-filled action on this surface. */}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit || transcribing}
          aria-label="Add to Idea Bank"
          title="Add to Idea Bank (⌘Enter)"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[color:var(--sg-accent)] text-white shadow-sm transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-35"
        >
          <ArrowUp className="h-5 w-5 stroke-[2.4]" />
        </button>
      </div>
    </div>
  );
}
