"use client";

import { useRef, useCallback } from "react";
import type { Topic } from "@/data/topics";

interface TopicReelProps {
  topic: Topic;
  spinning: boolean;
  reelBlurbs: string[];
  promptOverride: string | null;
  promptDraft: string;
  promptEditing?: boolean;
  onPromptDoubleTap?: () => void;
  onPromptDraftChange?: (value: string) => void;
  onPromptSave?: () => void;
  onPromptCancel?: () => void;
  promptEditable?: boolean;
}

export default function TopicReel({
  topic,
  spinning,
  reelBlurbs,
  promptOverride,
  promptDraft,
  promptEditing = false,
  onPromptDoubleTap,
  onPromptDraftChange,
  onPromptSave,
  onPromptCancel,
  promptEditable = false,
}: TopicReelProps) {
  const lastTapRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tryDoubleTap = useCallback(() => {
    if (!promptEditable || spinning || promptEditing) return;
    onPromptDoubleTap?.();
  }, [promptEditable, spinning, promptEditing, onPromptDoubleTap]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      tryDoubleTap();
    },
    [tryDoubleTap],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!promptEditable || spinning) return;
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        e.preventDefault();
        tryDoubleTap();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    },
    [promptEditable, spinning, tryDoubleTap],
  );

  const displayText = promptOverride ?? topic.text;
  const isCustom = promptOverride !== null;

  return (
    <div className="relative flex h-[150px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 px-7 py-7 text-center shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/30 dark:shadow-none">
      {spinning ? (
        <div className="animate-reel-spin flex flex-col gap-4">
          {reelBlurbs.map((t, i) => (
            <p
              key={i}
              className="m-0 font-serif text-lg text-slate-400 opacity-70 blur-[2px] dark:text-white dark:opacity-30"
            >
              {t}
            </p>
          ))}
        </div>
      ) : promptEditing ? (
        <div className="flex w-full flex-col items-center justify-center">
          <textarea
            ref={textareaRef}
            value={promptDraft}
            onChange={(e) => onPromptDraftChange?.(e.target.value)}
            onBlur={() => onPromptSave?.()}
            onFocus={(e) => {
              if (e.target.value.length === 0) return;
              e.target.setSelectionRange(
                e.target.value.length,
                e.target.value.length,
              );
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onPromptCancel?.();
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onPromptSave?.();
              }
            }}
            rows={3}
            className="w-full resize-none bg-transparent p-0 text-center font-serif text-xl leading-relaxed font-medium text-slate-900 outline-none dark:text-white"
            placeholder="Type your speaking prompt"
            autoFocus
          />
        </div>
      ) : (
        <div
          role={promptEditable ? "button" : undefined}
          tabIndex={promptEditable ? 0 : undefined}
          title={
            promptEditable ? "Double-tap to write your own prompt" : undefined
          }
          onDoubleClick={handleDoubleClick}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(e) => {
            if (
              promptEditable &&
              (e.key === "Enter" || e.key === " ") &&
              !spinning
            ) {
              e.preventDefault();
              tryDoubleTap();
            }
          }}
          className={`flex w-full touch-manipulation flex-col items-center justify-center outline-none ${
            promptEditable
              ? "cursor-pointer rounded-xl select-none focus-visible:ring-2 focus-visible:ring-blue-500/70 dark:focus-visible:ring-blue-400/60"
              : ""
          }`}
        >
          <div className="animate-fade-slide-in mb-4 flex justify-center gap-2 [animation-delay:50ms]">
            {isCustom ? (
              <>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase dark:bg-amber-400/15 dark:text-amber-200">
                  Custom
                </span>
                <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-700 uppercase dark:bg-white/10 dark:text-slate-300">
                  Your prompt
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-blue-800 uppercase dark:bg-blue-400/15 dark:text-blue-300">
                  {topic.category}
                </span>
                <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-700 uppercase dark:bg-white/10 dark:text-slate-300">
                  {topic.difficulty}
                </span>
              </>
            )}
          </div>
          <p className="animate-fade-slide-in m-0 max-h-[88px] overflow-y-auto font-serif text-xl leading-relaxed font-medium text-slate-900 [animation-delay:100ms] dark:text-white">
            {displayText}
          </p>
        </div>
      )}
    </div>
  );
}
