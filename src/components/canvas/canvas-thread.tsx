"use client";

import { useEffect, useRef } from "react";
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
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  if (messages.length === 0 && !failed) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-[13px] font-medium">
          Conversation
        </span>
        {messages.length > 0 && (
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
      {
        <div className="space-y-3">
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
      }
    </section>
  );
}
