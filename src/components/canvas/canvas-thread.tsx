"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import CanvasMessage from "@/components/canvas/canvas-message";
import { Button } from "@/components/ui/button";
import type { CanvasMessage as Message } from "@/hooks/use-canvas-thread";

/**
 * The conversation on this idea, above the prompt bar.
 *
 * Open whenever there is something in it, scrolled to the newest line, and
 * collapsible when the creator wants the canvas alone. Clearing it is a fresh
 * start for the talk, not for the page.
 */
export default function CanvasThread({
  messages,
  failed,
  onClear,
  addedIds,
  undoableId,
  onAddToPage,
  onUndo,
}: {
  messages: Message[];
  failed: boolean;
  onClear: () => void;
  /** Replies already placed on the page, so the button does not offer twice. */
  addedIds: Set<string>;
  /** The one reply whose canvas change can still be taken back. */
  undoableId: string | null;
  onAddToPage: (message: Message, asked: string) => void;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState(true);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, open]);

  if (messages.length === 0 && !failed) return null;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section className="mt-10">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase"
        >
          <Chevron className="h-3.5 w-3.5" />
          Conversation
          <span className="font-normal tracking-normal normal-case">
            · {messages.length}
          </span>
        </button>
        {open && messages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onClear}
            className="text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>
      {failed && (
        <p className="text-muted-foreground mb-2 text-xs">
          The earlier conversation couldn’t be loaded. New asks still work.
        </p>
      )}
      {open && (
        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => {
            const asked =
              [...messages.slice(0, index)]
                .reverse()
                .find((m) => m.role === "creator")?.text ?? "";
            return (
              <CanvasMessage
                key={message.id}
                message={message}
                canAddToPage={
                  message.role === "chirpy" &&
                  message.actions.length === 0 &&
                  !addedIds.has(message.id)
                }
                onAddToPage={() => onAddToPage(message, asked)}
                canUndo={message.id === undoableId}
                onUndo={onUndo}
              />
            );
          })}
          <div ref={end} />
        </div>
      )}
    </section>
  );
}
