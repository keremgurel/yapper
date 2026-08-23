"use client";

import {
  ChevronRight,
  FileText,
  GripVertical,
  List,
  ScrollText,
  Table2,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import BlockEditor from "@/components/brain/blocks/block-editor";
import UsageSelect from "@/components/brain/blocks/usage-select";
import { sizeLabel } from "@/components/brain/usage";
import { describeBlock } from "@/lib/brain/context/excerpt";
import type { BrainBlock, BrainBlockPatch } from "@/lib/brain/client";
import type { BrainBlockKind } from "@/lib/db/schema";

const KIND_ICONS: Record<BrainBlockKind, LucideIcon> = {
  note: FileText,
  list: List,
  table: Table2,
  doc: ScrollText,
};

/**
 * A section as a row.
 *
 * This is the change that makes a brain with twenty sections manageable. As
 * cards, twenty sections is a page you scroll for a minute to find the one you
 * wanted; as forty pixel rows, it is a list you read. The row carries the four
 * things worth deciding from: what it is called, what it is for, how much of it
 * the AI reads, and how big it is.
 *
 * It opens in place rather than into a modal, so the thing you were comparing
 * it against is still on screen.
 */
export default function BlockRow({
  block,
  open,
  onToggle,
  onEdit,
  onRemove,
  dragHandleProps,
}: {
  block: BrainBlock;
  open: boolean;
  onToggle: () => void;
  onEdit: (patch: BrainBlockPatch) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const Icon = KIND_ICONS[block.kind] ?? FileText;
  // The creator's digest when they wrote one; the shape when they have not, so
  // the row never reads as empty.
  const subtitle = block.digest || describeBlock(block);

  return (
    <div className="group">
      <div className="hover:bg-muted/50 flex min-h-10 items-center gap-2 px-2 transition-colors">
        <span
          {...dragHandleProps}
          aria-hidden
          className="text-muted-foreground/50 cursor-grab opacity-0 transition-opacity group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left"
        >
          <ChevronRight
            aria-hidden
            className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
          <Icon
            aria-hidden
            className="text-muted-foreground h-4 w-4 shrink-0"
          />
          <span className="text-foreground shrink-0 text-sm font-medium">
            {block.title || "Untitled"}
          </span>
          <span className="text-muted-foreground min-w-0 truncate text-[13px]">
            {subtitle}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted-foreground hidden font-mono text-xs tabular-nums sm:inline">
            {sizeLabel(block.charCount)}
          </span>
          <UsageSelect
            usage={block.usage}
            onChange={(usage) => onEdit({ usage })}
          />
          <button
            type="button"
            aria-label={`Delete ${block.title || "section"}`}
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive rounded p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="px-4 pb-2">
            <input
              value={block.title}
              aria-label="Section title"
              placeholder="Call it whatever you call it"
              onChange={(event) => onEdit({ title: event.target.value })}
              className="text-foreground w-full max-w-[68ch] bg-transparent text-sm font-medium outline-none"
            />
          </div>
          <BlockEditor block={block} onEdit={onEdit} />
        </>
      )}
    </div>
  );
}
