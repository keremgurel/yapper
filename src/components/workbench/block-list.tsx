"use client";

import { Plus } from "lucide-react";
import BlockEditor from "@/components/workbench/block-editor";
import Section from "@/components/workbench/section";
import { Button } from "@/components/ui/button";
import {
  addBlock,
  changeBlockKind,
  moveBlock,
  removeBlock,
  updateBlock,
} from "@/lib/content/block-edits";
import type { ContentBlock } from "@/lib/db/schema";

/**
 * The adaptive body: whatever sections this particular idea needed.
 *
 * There is no fixed set of fields here by design. An idea built from a sketch
 * gets beat-by-beat and audio cues; an explainer gets key points and an
 * example. Both are the same data model, which is what stopped the old
 * send-to-library step from having to flatten one into the other.
 */
export default function BlockList({
  blocks,
  onChange,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
}) {
  return (
    <Section title="Breakdown" rank="quiet">
      {blocks.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No sections yet. Generate with AI, or add one and write it yourself.
        </p>
      ) : (
        <div className="space-y-5">
          {blocks.map((block, i) => (
            <BlockEditor
              key={i}
              block={block}
              index={i}
              isFirst={i === 0}
              isLast={i === blocks.length - 1}
              onPatch={(patch) => onChange(updateBlock(blocks, i, patch))}
              onKind={(kind) => onChange(changeBlockKind(blocks, i, kind))}
              onMove={(direction) => onChange(moveBlock(blocks, i, direction))}
              onRemove={() => onChange(removeBlock(blocks, i))}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange(addBlock(blocks))}
        className="text-muted-foreground mt-2 -ml-2"
      >
        <Plus className="h-4 w-4" /> Add section
      </Button>
    </Section>
  );
}
