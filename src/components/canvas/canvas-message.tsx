"use client";

import { Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanvasMessage as Message } from "@/hooks/use-canvas-thread";
import { describeCanvasActions } from "@/lib/content/canvas-actions";

/**
 * One line of the conversation. A creator's line is plain. Chirpy's carries
 * what it changed, and, when it only answered, a way to put that answer on the
 * page. The newest reply that changed the canvas can be undone.
 */
export default function CanvasMessage({
  message,
  canAddToPage,
  onAddToPage,
  canUndo,
  onUndo,
}: {
  message: Message;
  canAddToPage: boolean;
  onAddToPage: () => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const creator = message.role === "creator";
  return (
    <div className={`flex ${creator ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[68ch] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
          creator
            ? "bg-muted text-foreground rounded-br-md"
            : "text-foreground rounded-bl-md"
        } ${message.pending ? "opacity-60" : ""}`}
      >
        {!creator && (
          <span className="text-muted-foreground mb-0.5 block text-[11px] font-bold tracking-[0.1em] uppercase">
            Chirpy
          </span>
        )}
        <p className="whitespace-pre-wrap">{message.text}</p>
        {!creator && message.actions.length > 0 && (
          <p className="text-muted-foreground mt-1 text-xs">
            {describeCanvasActions(message.actions)}
          </p>
        )}
        {!creator && (canAddToPage || canUndo) && (
          <div className="mt-1.5 flex gap-1">
            {canAddToPage && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onAddToPage}
                className="text-muted-foreground -ml-2"
              >
                <Plus className="h-3 w-3" /> Add to page
              </Button>
            )}
            {canUndo && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onUndo}
                className="text-muted-foreground"
              >
                <Undo2 className="h-3 w-3" /> Undo this change
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
