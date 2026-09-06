"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isListKind } from "@/lib/content/block-edits";
import type {
  CanvasBlock as Block,
  CanvasKind,
} from "@/lib/content/canvas-doc";

const KINDS: { value: CanvasKind; label: string }[] = [
  { value: "paragraph", label: "Text" },
  { value: "script", label: "Script" },
  { value: "bullets", label: "Bullets" },
  { value: "steps", label: "Steps" },
];

/**
 * One block on the canvas: a label you name, and its words.
 *
 * A script block is set larger, because it is what gets read aloud. The
 * controls (kind, move, remove, ask Chirpy about this block) appear on hover
 * and focus only. A block has no border and no card; the label and the gap
 * above it are the grouping, the same way a heading works on a page.
 */
export default function CanvasBlock({
  block,
  index,
  isFirst,
  isLast,
  onChange,
  onKind,
  onMove,
  onRemove,
  onAsk,
}: {
  block: Block;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<Omit<Block, "id">>) => void;
  onKind: (kind: CanvasKind) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onAsk: () => void;
}) {
  const list = isListKind(block.kind);
  const script = block.kind === "script";
  const value = list ? block.items.join("\n") : block.text;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const rendered = list && !editing && block.items.some((item) => item.trim());

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(element.scrollHeight, script ? 120 : 56)}px`;
  }, [value, script, rendered]);

  return (
    <div className="group relative" data-block-index={index}>
      <div className="mb-1 flex items-center gap-2">
        <input
          value={block.label}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="Name this block"
          aria-label={`Block ${index + 1} label`}
          className="text-muted-foreground placeholder:text-muted-foreground/50 focus:text-foreground min-w-0 flex-1 bg-transparent text-[11px] font-bold tracking-[0.1em] uppercase outline-none"
        />
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onAsk}
            className="text-muted-foreground"
            aria-label={`Ask Chirpy about block ${index + 1}`}
            title="Ask Chirpy about this block"
          >
            <Sparkles className="h-3 w-3" /> Ask
          </Button>
          <select
            value={block.kind}
            onChange={(event) => onKind(event.target.value as CanvasKind)}
            aria-label={`Block ${index + 1} kind`}
            className="text-muted-foreground h-6 cursor-pointer rounded border-0 bg-transparent text-[11px] font-bold outline-none"
          >
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label={`Move block ${index + 1} up`}
            className="text-muted-foreground"
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label={`Move block ${index + 1} down`}
            className="text-muted-foreground"
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            aria-label={`Remove block ${index + 1}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <X />
          </Button>
        </div>
      </div>

      {rendered ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left"
          aria-label={`Edit block ${index + 1}`}
        >
          <ul
            className={`text-foreground/90 max-w-[68ch] space-y-1 text-[15px] leading-relaxed ${
              block.kind === "steps" ? "list-decimal" : "list-disc"
            } pl-5`}
          >
            {block.items
              .filter((item) => item.trim())
              .map((item, i) => (
                <li key={i}>{item}</li>
              ))}
          </ul>
        </button>
      ) : (
        <textarea
          ref={ref}
          value={value}
          autoFocus={editing}
          onBlur={() => setEditing(false)}
          onChange={(event) =>
            onChange(
              list
                ? {
                    items: event.target.value
                      .split("\n")
                      .map((line) => line.replace(/^\s+/, "")),
                  }
                : { text: event.target.value },
            )
          }
          placeholder={
            script
              ? "The words you will say, or ask Chirpy below."
              : list
                ? "One per line"
                : "Write here, or ask Chirpy below."
          }
          aria-label={`Block ${index + 1} content`}
          className={`placeholder:text-muted-foreground/50 w-full max-w-[68ch] resize-none bg-transparent outline-none ${
            script
              ? "text-foreground text-[17px] leading-[1.75]"
              : "text-foreground/90 text-[15px] leading-relaxed"
          }`}
        />
      )}
    </div>
  );
}
