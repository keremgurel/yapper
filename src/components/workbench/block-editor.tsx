"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isListKind } from "@/lib/content/block-edits";
import type { ContentBlock } from "@/lib/db/schema";

const KINDS: { value: ContentBlock["kind"]; label: string }[] = [
  { value: "paragraph", label: "Prose" },
  { value: "bullets", label: "Bullets" },
  { value: "steps", label: "Steps" },
  { value: "script", label: "Script" },
];

/**
 * One section of the flexible body.
 *
 * Two things drive this design. A list is *rendered* as a list until you click
 * into it — the old editor showed bullets as flat lines inside a textarea, so
 * seven sections read as one undifferentiated wall of text. And the controls
 * (kind, reorder, delete) only appear on hover or focus: five of them per
 * block, always visible, across seven blocks was thirty-five things competing
 * with the words they act on.
 *
 * The block itself has no border. Nesting a bordered textarea inside a bordered
 * card inside a bordered column is what made the page feel like a form; here
 * the label and a hairline carry the grouping instead.
 */
export default function BlockEditor({
  block,
  index,
  isFirst,
  isLast,
  onPatch,
  onKind,
  onMove,
  onRemove,
}: {
  block: ContentBlock;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onPatch: (patch: Partial<ContentBlock>) => void;
  onKind: (kind: ContentBlock["kind"]) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const list = isListKind(block.kind);
  const items = (block.items ?? []).filter((i) => i.trim());
  const value = list ? (block.items ?? []).join("\n") : (block.text ?? "");
  const showRendered = list && !editing && items.length > 0;

  return (
    <div className="group border-border/60 relative border-l pl-4">
      <div className="mb-1 flex items-center gap-2">
        <input
          value={block.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="Section label"
          aria-label={`Section ${index + 1} label`}
          className="text-foreground placeholder:text-muted-foreground/60 min-w-0 flex-1 bg-transparent text-[13px] font-black tracking-tight outline-none"
        />

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <select
            value={block.kind}
            onChange={(e) => onKind(e.target.value as ContentBlock["kind"])}
            aria-label={`Section ${index + 1} kind`}
            className="text-muted-foreground h-6 cursor-pointer rounded border-0 bg-transparent text-[11px] font-bold outline-none"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label={`Move section ${index + 1} up`}
            className="text-muted-foreground h-6 w-6"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label={`Move section ${index + 1} down`}
            className="text-muted-foreground h-6 w-6"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remove section ${index + 1}`}
            className="text-muted-foreground hover:text-destructive h-6 w-6"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {showRendered ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left"
          aria-label={`Edit section ${index + 1}`}
        >
          <ul
            className={`text-foreground/85 max-w-[68ch] space-y-1 text-[15px] leading-relaxed ${
              block.kind === "steps" ? "list-decimal" : "list-disc"
            } pl-5 marker:text-[color:var(--sg-accent)]/50`}
          >
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </button>
      ) : (
        <textarea
          value={value}
          rows={list ? Math.max(2, (block.items ?? []).length) : 4}
          autoFocus={editing}
          onBlur={() => setEditing(false)}
          onChange={(e) =>
            onPatch(
              list
                ? {
                    items: e.target.value
                      .split("\n")
                      // Blank lines survive while typing; dropping them would
                      // fight the cursor. normalizeBlocks strips them on read.
                      .map((line) => line.replace(/^\s+/, "")),
                  }
                : { text: e.target.value },
            )
          }
          placeholder={list ? "One item per line" : "Write this section"}
          aria-label={`Section ${index + 1} content`}
          className="text-foreground/85 placeholder:text-muted-foreground/60 w-full max-w-[68ch] resize-none bg-transparent text-[15px] leading-relaxed outline-none"
        />
      )}
    </div>
  );
}
