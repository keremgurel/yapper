"use client";

import { Loader2, Plus } from "lucide-react";
import BlockList from "@/components/brain/blocks/block-list";
import { Button } from "@/components/ui/button";
import type { useBrainBlocks } from "@/hooks/use-brain-blocks";

type Blocks = ReturnType<typeof useBrainBlocks>;

/** The Knowledge tab: the list of what Yapper knows, with one Add action. */
export default function KnowledgeTab({
  blocks,
  loading,
  available,
  saveState,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
}: {
  blocks: Blocks["blocks"];
  loading: boolean;
  available: boolean;
  saveState: Blocks["saveState"];
  onAdd: () => void;
  onEdit: Parameters<typeof BlockList>[0]["onEdit"];
  onRemove: Parameters<typeof BlockList>[0]["onRemove"];
  onReorder: Parameters<typeof BlockList>[0]["onReorder"];
}) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-foreground text-[22px] font-semibold tracking-[-0.01em]">
            Knowledge
          </h2>
          <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm">
            Research, stories, examples, and rules Yapper pulls in when they
            matter.
          </p>
        </div>
        <Button type="button" disabled={!available} onClick={onAdd}>
          <Plus className="size-4" aria-hidden="true" /> Add knowledge
        </Button>
      </div>
      <div className="border-border bg-card rounded-2xl border p-4 sm:p-5">
        {saveState === "error" ? (
          <p className="text-destructive mb-3 text-xs" role="alert">
            A memory could not be saved. Your next edit retries it.
          </p>
        ) : null}
        {loading ? (
          <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading Knowledge…
          </p>
        ) : !available ? (
          <p className="text-muted-foreground py-6 text-sm">
            Your Knowledge will appear after it loads successfully.
          </p>
        ) : (
          <BlockList
            blocks={blocks}
            onEdit={onEdit}
            onRemove={onRemove}
            onReorder={onReorder}
          />
        )}
      </div>
    </section>
  );
}
