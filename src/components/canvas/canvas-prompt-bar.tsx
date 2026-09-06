"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Loader2, X } from "lucide-react";
import type { CanvasAskError } from "@/hooks/use-canvas-ask";

const SUGGESTIONS = [
  "Write the script",
  "Give me five hooks",
  "Tighten this into 30 seconds",
  "Add a section on objections",
];

/**
 * Where you tell Chirpy what to write.
 *
 * One field, no menu of generators. "Write the script", "five hooks", "add a
 * section on why this matters", "make block two punchier" all go in the same
 * box. Aiming at a block (from its Ask button) shows as a removable chip, so
 * the ask reads as "about Script: make it punchier".
 */
export default function CanvasPromptBar({
  busy,
  error,
  note,
  target,
  onClearTarget,
  onAsk,
  focusToken,
}: {
  busy: boolean;
  error: CanvasAskError | null;
  note: string | null;
  target: { label: string } | null;
  onClearTarget: () => void;
  onAsk: (instruction: string) => Promise<void>;
  /** Changes when something wants the field focused (a block's Ask button). */
  focusToken: number;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusToken > 0) ref.current?.focus();
  }, [focusToken]);

  const send = async () => {
    const instruction = text.trim();
    if (!instruction || busy) return;
    await onAsk(instruction);
    setText("");
  };

  return (
    <div className="sticky bottom-4 mt-10">
      <div className="sg-glass focus-within:border-foreground/25 p-2 transition-[border-color,box-shadow] focus-within:shadow-md">
        {target && (
          <div className="flex items-center gap-2 px-2 pt-1">
            <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold">
              About: {target.label || "this block"}
              <button
                type="button"
                onClick={onClearTarget}
                aria-label="Stop aiming at this block"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={ref}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            disabled={busy}
            placeholder="Ask Chirpy to write anything…"
            aria-label="Ask Chirpy"
            className="text-foreground placeholder:text-muted-foreground/70 max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !text.trim()}
            aria-label="Send to Chirpy"
            title="Send (Enter)"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--sg-accent)] text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-35"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5 stroke-[2.4]" />
            )}
          </button>
        </div>
        <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 px-3 pb-1">
          {error === "locked" ? (
            <Link href="/pricing" className="text-xs font-semibold underline">
              Subscribe to write with Chirpy
            </Link>
          ) : error === "insufficient" ? (
            <span className="text-xs font-semibold text-[color-mix(in_oklab,var(--sg-yellow-500)_48%,var(--sg-text))]">
              Out of credits. Top up to keep going.
            </span>
          ) : error === "limited" ? (
            <span className="text-muted-foreground text-xs">
              That is as many asks as this hour allows. Try again in a bit.
            </span>
          ) : error === "failed" ? (
            <span className="text-destructive text-xs">
              Chirpy couldn’t answer that. Nothing was charged. Try again.
            </span>
          ) : note ? (
            <span className="text-muted-foreground text-xs">{note}</span>
          ) : busy ? (
            <span className="text-muted-foreground text-xs">Writing…</span>
          ) : text ? (
            <span className="text-muted-foreground text-xs">1 credit</span>
          ) : (
            SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setText(suggestion);
                  ref.current?.focus();
                }}
                className="text-muted-foreground hover:text-foreground text-xs transition-colors"
              >
                {suggestion}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
