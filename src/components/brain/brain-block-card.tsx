"use client";

import { ChevronDown, ChevronUp, EyeOff, Trash2 } from "lucide-react";
import BrainListEditor from "@/components/brain/brain-list-editor";
import { Textarea } from "@/components/ui/textarea";
import type { BrainBlock, BrainBlockPatch } from "@/lib/brain/client";

/**
 * One section of the brain, as the creator wrote it.
 *
 * Everything is editable where it sits: the title is the title, not a label
 * over a form. That is the whole difference between a brain and a settings
 * page, and it is why blocks can be renamed into whatever the creator actually
 * calls the thing.
 */
export default function BrainBlockCard({
  block,
  onEdit,
  onMove,
  onRemove,
}: {
  block: BrainBlock;
  onEdit: (patch: BrainBlockPatch) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <section className="sg-card p-4 sm:p-5">
      <header className="flex items-start gap-2">
        <input
          value={block.title}
          aria-label="Section title"
          onChange={(event) => onEdit({ title: event.target.value })}
          className="text-foreground min-w-0 flex-1 bg-transparent text-sm font-bold tracking-wide uppercase outline-none"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Move up"
            onClick={() => onMove(-1)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            onClick={() => onMove(1)}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded p-1"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={
              block.inContext
                ? "Keep out of AI prompts"
                : "Let the AI read this"
            }
            title={
              block.inContext
                ? "The AI reads this section"
                : "Kept out of AI prompts"
            }
            aria-pressed={!block.inContext}
            onClick={() => onEdit({ inContext: !block.inContext })}
            className={`rounded p-1 ${
              block.inContext
                ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                : "text-[color:var(--sg-accent)]"
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete section"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive hover:bg-muted rounded p-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="mt-3">
        {block.kind === "list" ? (
          <BrainListEditor
            items={block.items}
            placeholder="Add a line"
            onChange={(items) => onEdit({ items })}
          />
        ) : (
          <Textarea
            value={block.body}
            rows={4}
            aria-label={`${block.title} notes`}
            placeholder="Write it the way you would say it."
            onChange={(event) => onEdit({ body: event.target.value })}
          />
        )}
      </div>

      {!block.inContext && (
        <p className="text-muted-foreground mt-2 text-xs">
          Kept out of AI prompts. Yours to read, not the model&apos;s.
        </p>
      )}
    </section>
  );
}
