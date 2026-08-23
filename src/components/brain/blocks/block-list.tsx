"use client";

import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import BlockRow from "@/components/brain/blocks/block-row";
import { Chip, EmptyState, Toolbar } from "@/components/studio-ui";
import { Input } from "@/components/ui/input";
import { useDragOrder } from "@/hooks/use-drag-order";
import type { BrainBlock, BrainBlockPatch } from "@/lib/brain/client";

/**
 * Everything the creator has written or imported, as one list.
 *
 * Filtering rather than grouping. Sections belong to more than one tag often
 * enough that groups would duplicate them, and the creator's own order is the
 * thing dragging is for; a grouped list makes "drag it above that one" mean two
 * different things.
 *
 * Dragging is disabled while a filter is on, deliberately. Dropping row three
 * of a filtered view has no honest meaning in the full order.
 */
export default function BlockList({
  blocks,
  onEdit,
  onRemove,
  onReorder,
}: {
  blocks: BrainBlock[];
  onEdit: (id: string, patch: BrainBlockPatch) => void;
  onRemove: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const tags = useMemo(() => {
    const seen = new Map<string, number>();
    for (const block of blocks) {
      for (const value of block.tags) {
        seen.set(value, (seen.get(value) ?? 0) + 1);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([value]) => value);
  }, [blocks]);

  const needle = query.trim().toLowerCase();
  const filtered = blocks.filter((block) => {
    if (tag && !block.tags.includes(tag)) return false;
    if (!needle) return true;
    return `${block.title} ${block.digest} ${block.tags.join(" ")}`
      .toLowerCase()
      .includes(needle);
  });
  const filtering = Boolean(tag || needle);

  const { order, handleProps, rowProps } = useDragOrder(
    blocks.map((block) => block.id),
    onReorder,
  );
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const rows = filtering
    ? filtered
    : order
        .map((id) => byId.get(id))
        .filter((block): block is BrainBlock => Boolean(block));

  if (!blocks.length) {
    return (
      <EmptyState
        icon={Layers}
        title="Nothing in here yet"
        description="Add a section, or paste something you already researched. Everything Yapper writes reads this first."
      />
    );
  }

  return (
    <div>
      {(tags.length > 0 || blocks.length > 6) && (
        <Toolbar
          end={
            <Input
              value={query}
              placeholder="Find a section"
              aria-label="Find a section"
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 w-44 text-sm"
            />
          }
        >
          {tags.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tag === value}
              onClick={() => setTag(tag === value ? null : value)}
              className="focus-visible:ring-ring/50 rounded-md focus-visible:ring-2 focus-visible:outline-none"
            >
              <Chip tone={tag === value ? "cyan" : "neutral"}>{value}</Chip>
            </button>
          ))}
        </Toolbar>
      )}

      <div className="border-border divide-border/60 divide-y rounded-xl border">
        {rows.map((block) => (
          <div key={block.id} {...(filtering ? {} : rowProps(block.id))}>
            <BlockRow
              block={block}
              open={openId === block.id}
              onToggle={() => setOpenId(openId === block.id ? null : block.id)}
              onEdit={(patch) => onEdit(block.id, patch)}
              onRemove={() => onRemove(block.id)}
              dragHandleProps={filtering ? undefined : handleProps(block.id)}
            />
          </div>
        ))}
        {!rows.length && (
          <p className="text-muted-foreground px-4 py-6 text-[13px]">
            Nothing matches that.
          </p>
        )}
      </div>
    </div>
  );
}
