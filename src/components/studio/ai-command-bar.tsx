"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowUp, GripVertical, Loader2, X } from "lucide-react";
import { useAutosizeTextarea } from "@/hooks/use-autosize-textarea";
import AiEmptyPrompt from "@/components/studio/ai-empty-prompt";
import AiTranscribePrompt from "@/components/studio/ai-transcribe-prompt";
import { useMentionInput } from "@/hooks/use-mention-input";
import type { useOverlayPlacement } from "@/hooks/use-overlay-placement";
import type { MediaAsset } from "@/lib/studio/types";

/**
 * The expanded assistant, in three states: no video, no transcript, and ready to
 * take an instruction. Each earlier state offers the one thing that unlocks the
 * next, so the bar is never a wall of text telling you what you cannot do.
 *
 * Typing `@` offers the library. Placing cutaways is all it knows for now; the
 * bar is the place to put whatever it learns next.
 */
export default function AiCommandBar({
  assets,
  hasProject,
  hasTranscript,
  open,
  placement,
  onDragHandle,
  onClose,
}: {
  assets: MediaAsset[];
  /** Without a video there is nothing to lay a cutaway over. */
  hasProject: boolean;
  hasTranscript: boolean;
  /** The bar stays mounted while closed so it can shrink away, not blink out. */
  open: boolean;
  /** Owned by the assistant, because the bird's face reads from it too. */
  placement: ReturnType<typeof useOverlayPlacement>;
  /** Drag the bar by its header, exactly as you drag the bird. */
  onDragHandle: (e: React.PointerEvent) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const names = useMemo(() => assets.map((a) => a.name), [assets]);
  const mention = useMentionInput(names, inputRef);
  const { status, message, result, run, reset } = placement;
  useAutosizeTextarea(inputRef, mention.value);
  const busy = status === "thinking";
  const ready = hasProject && hasTranscript && assets.length > 0;

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
    <div className="border-border bg-card w-[32rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border shadow-2xl">
      <div
        onPointerDown={onDragHandle}
        className="border-border/60 flex cursor-grab items-center gap-2 border-b px-3.5 py-2.5 active:cursor-grabbing"
      >
        <GripVertical className="text-foreground/25 h-4 w-4 shrink-0" />
        <span className="text-foreground/80 flex-1 text-sm font-bold">
          {hasProject ? "Tell the editor what to do" : "Let's make something"}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-foreground/40 hover:text-foreground/80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative px-3.5 py-3">
        {mention.suggestions.length > 0 && (
          <ul className="border-border bg-popover absolute right-3.5 bottom-full z-10 mb-1 max-h-56 overflow-auto rounded-lg border py-1 shadow-xl">
            {mention.suggestions.map((name, i) => (
              <li key={name}>
                <button
                  type="button"
                  // pointerdown, not click: the input must not blur first.
                  onPointerDown={(e) => {
                    e.preventDefault();
                    mention.accept(name);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                    i === mention.active
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/70"
                  }`}
                >
                  <span className="text-[color:var(--sg-accent)]">@</span>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!hasProject ? (
          <AiEmptyPrompt />
        ) : !hasTranscript ? (
          <AiTranscribePrompt />
        ) : (
          <>
            <div className="bg-foreground/5 flex items-end gap-2 rounded-xl px-3 py-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={mention.value}
                disabled={!ready || busy}
                placeholder={
                  ready
                    ? "Show @clip.mp4 when I talk about the launch"
                    : "Upload a photo or a clip first"
                }
                {...mention.handlers}
                onKeyDown={(e) => {
                  if (mention.handlers.onKeyDown(e)) return;
                  // Enter sends. A newline needs Shift, as it does in every chat box.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                  if (e.key === "Escape") onClose();
                }}
                className="placeholder:text-foreground/30 max-h-40 min-w-0 flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed outline-none disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={submit}
                disabled={!ready || busy || !mention.value.trim()}
                aria-label="Send"
                style={{ background: "var(--sg-accent-gradient)" }}
                className="mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white transition-opacity disabled:opacity-30"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>

            {assets.length === 0 && (
              <p className="text-foreground/50 mt-2.5 text-xs">
                Upload a photo or a clip, then tell me where it goes.
              </p>
            )}
          </>
        )}

        {status === "done" && result && result.placed > 0 && (
          <div className="mt-3">
            <p className="text-sm font-bold text-[color:var(--sg-green-500)]">
              Placed {result.placed}{" "}
              {result.placed === 1 ? "cutaway" : "cutaways"}. Undo puts it back.
            </p>
            <ul className="mt-1 space-y-0.5">
              {result.notes.map((n) => (
                <li key={n} className="text-foreground/55 truncate text-xs">
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {message && (
          <p
            className={`mt-3 text-xs ${
              status === "error"
                ? "text-[color:var(--sg-pink-500)]"
                : "text-foreground/55"
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
            className="text-foreground/50 hover:text-foreground/80 mt-2.5 text-xs font-bold"
          >
            Ask for something else
          </button>
        )}
      </div>
    </div>
  );
}
