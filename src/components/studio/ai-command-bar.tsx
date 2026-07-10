"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowUp, Loader2, Sparkles, X } from "lucide-react";
import { useMentionInput } from "@/hooks/use-mention-input";
import { useOverlayPlacement } from "@/hooks/use-overlay-placement";
import type { MediaAsset } from "@/lib/studio/types";

/**
 * The expanded assistant: say where the media goes, in words. Typing `@` offers
 * the library. It only knows about placing cutaways for now; the bar is the
 * place to put whatever it learns next.
 */
export default function AiCommandBar({
  assets,
  hasTranscript,
  open,
  onClose,
}: {
  assets: MediaAsset[];
  hasTranscript: boolean;
  /** The bar stays mounted while closed so it can shrink away, not blink out. */
  open: boolean;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => assets.map((a) => a.name), [assets]);
  const mention = useMentionInput(names, inputRef);
  const { status, message, result, run, reset } = useOverlayPlacement();
  const busy = status === "thinking";
  const ready = hasTranscript && assets.length > 0;

  // Only once it is actually open. A hidden box that steals focus on mount
  // would swallow the editor's Space, S, and Delete.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    const text = mention.value.trim();
    if (!text || busy || !ready) return;
    void run(text);
  };

  return (
    <div className="border-border bg-card w-[26rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border shadow-2xl">
      <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-fuchsia-400" />
        <span className="text-foreground/70 flex-1 text-xs font-bold">
          Tell the editor what to do
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-foreground/40 hover:text-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative px-3 py-2.5">
        {mention.suggestions.length > 0 && (
          <ul className="border-border bg-popover absolute right-3 bottom-full z-10 mb-1 max-h-56 overflow-auto rounded-lg border py-1 shadow-xl">
            {mention.suggestions.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  // pointerdown, not click: the input must not blur first.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    mention.accept(name);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${
                    i === mention.active
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/70"
                  }`}
                >
                  <span className="text-fuchsia-400">@</span>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="bg-foreground/5 flex items-center gap-2 rounded-xl px-3 py-2">
          <input
            ref={inputRef}
            value={mention.value}
            disabled={!ready || busy}
            placeholder={
              ready
                ? "Show @clip.mp4 when I talk about the launch"
                : "Transcribe the video first"
            }
            {...mention.handlers}
            onKeyDown={(e) => {
              if (mention.handlers.onKeyDown(e)) return;
              if (e.key === "Enter") submit();
              if (e.key === "Escape") onClose();
            }}
            className="placeholder:text-foreground/30 min-w-0 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!ready || busy || !mention.value.trim()}
            aria-label="Send"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-fuchsia-500 text-white transition-opacity disabled:opacity-30"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!hasTranscript && (
          <p className="text-foreground/40 mt-2 text-[11px]">
            Placing a cutaway needs the words. Run Transcribe, or a one click
            edit, and come back.
          </p>
        )}

        {status === "done" && result && result.placed > 0 && (
          <div className="mt-2.5">
            <p className="text-xs font-bold text-emerald-400">
              Placed {result.placed}{" "}
              {result.placed === 1 ? "cutaway" : "cutaways"}. Undo puts it back.
            </p>
            <ul className="mt-1 space-y-0.5">
              {result.notes.map((n) => (
                <li key={n} className="text-foreground/50 truncate text-[11px]">
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && (
          <p
            className={`mt-2.5 text-[11px] ${
              status === "error" ? "text-rose-400" : "text-foreground/50"
            }`}
          >
            {message}
          </p>
        )}

        {(status === "done" || status === "error") && (
          <button
            type="button"
            onClick={() => {
              reset();
              mention.setValue("");
              inputRef.current?.focus();
            }}
            className="text-foreground/40 hover:text-foreground/70 mt-2 text-[11px] font-bold"
          >
            Ask for something else
          </button>
        )}
      </div>
    </div>
  );
}
