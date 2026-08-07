"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isListKind } from "@/lib/content/block-edits";
import type { ContentBlock } from "@/lib/db/schema";

const KINDS: { value: ContentBlock["kind"]; label: string }[] = [
  { value: "paragraph", label: "Prose" },
  { value: "bullets", label: "Bullets" },
  { value: "steps", label: "Steps" },
  { value: "script", label: "Script" },
];

/**
 * One section of the flexible body: its label, its kind, and its content.
 *
 * The label is a free-text input rather than a fixed heading, which is the
 * whole point of the body being adaptive: the model names sections to fit the
 * idea, and the creator can rename them to fit it better.
 *
 * A list kind edits as one line per item, so reordering or adding an item is
 * ordinary typing instead of a row of controls.
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
  const list = isListKind(block.kind);
  const value = list ? (block.items ?? []).join("\n") : (block.text ?? "");

  return (
    <div className="border-border rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={block.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="Section label"
          aria-label={`Section ${index + 1} label`}
          className="text-foreground placeholder:text-muted-foreground/60 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
        />
        <select
          value={block.kind}
          onChange={(e) => onKind(e.target.value as ContentBlock["kind"])}
          aria-label={`Section ${index + 1} kind`}
          className="border-border bg-card text-foreground/80 h-8 cursor-pointer rounded-md border px-2 text-xs"
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
          className="text-muted-foreground"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label={`Move section ${index + 1} down`}
          className="text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove section ${index + 1}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Textarea
        value={value}
        rows={list ? Math.max(2, (block.items ?? []).length) : 4}
        onChange={(e) =>
          onPatch(
            list
              ? {
                  items: e.target.value
                    .split("\n")
                    // Blank lines are kept while typing (dropping them would
                    // fight the cursor); normalizeBlocks strips them on read.
                    .map((line) => line.replace(/^\s+/, "")),
                }
              : { text: e.target.value },
          )
        }
        placeholder={list ? "One item per line" : "Write this section"}
        aria-label={`Section ${index + 1} content`}
      />
    </div>
  );
}
