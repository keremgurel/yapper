"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import BlockList from "@/components/workbench/block-list";
import VerbatimNote from "@/components/workbench/verbatim-note";
import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/lib/db/schema";

/**
 * The thinking behind the shoot: your original words, and the breakdown.
 *
 * Collapsed by default once there is a script, because at that point the script
 * is what you are working on and the notes are what got you there. Open when
 * there is no script yet, since then the notes are the work.
 */
export default function PlanningNotes({
  blocks,
  originalNote,
  hasScript,
  onChange,
  generating,
  canGenerate,
  onGenerate,
}: {
  blocks: ContentBlock[];
  originalNote: string;
  hasScript: boolean;
  onChange: (blocks: ContentBlock[]) => void;
  generating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const [open, setOpen] = useState(!hasScript);
  const Chevron = open ? ChevronDown : ChevronRight;
  const count = blocks.length + (originalNote.trim() ? 1 : 0);

  return (
    <section className="border-border border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase"
        >
          <Chevron className="h-3.5 w-3.5" />
          Planning notes{count ? ` (${count})` : ""}
        </button>

        {open && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={generating || !canGenerate}
            title={canGenerate ? "Rebuild the breakdown" : "Add a title first"}
            className="h-7 text-xs"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Rebuild breakdown · 2 credits
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-5">
          <VerbatimNote note={originalNote} />
          <BlockList blocks={blocks} onChange={onChange} />
        </div>
      )}
    </section>
  );
}
