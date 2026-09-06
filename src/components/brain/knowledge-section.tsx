"use client";

import { Loader2, Plus } from "lucide-react";
import BlockList from "@/components/brain/blocks/block-list";
import { Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import type { useBrainBlocks } from "@/hooks/use-brain-blocks";

type Blocks = ReturnType<typeof useBrainBlocks>;

/** What Yapper knows: the list, and one button to add to it. */
export default function KnowledgeSection({
  blocks,
  loading,
  available,
  saveFailed,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
}: {
  blocks: Blocks["blocks"];
  loading: boolean;
  available: boolean;
  saveFailed: boolean;
  onAdd: () => void;
  onEdit: Parameters<typeof BlockList>[0]["onEdit"];
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  return (
    <Section
      title="Knowledge"
      meta={blocks.length ? String(blocks.length) : undefined}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!available}
          onClick={onAdd}
        >
          <Plus className="size-4" aria-hidden="true" /> Add
        </Button>
      }
    >
      {saveFailed ? (
        <p className="text-destructive mb-3 text-xs" role="alert">
          A change could not be saved. Your next edit retries it.
        </p>
      ) : null}
      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      ) : !available ? (
        <p className="text-muted-foreground py-6 text-sm">
          Your Knowledge will appear once it loads.
        </p>
      ) : (
        <BlockList
          blocks={blocks}
          onEdit={onEdit}
          onRemove={onRemove}
          onReorder={onReorder}
        />
      )}
    </Section>
  );
}
