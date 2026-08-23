"use client";

import DocEditor from "@/components/brain/blocks/editors/doc-editor";
import ListEditor from "@/components/brain/blocks/editors/list-editor";
import NoteEditor from "@/components/brain/blocks/editors/note-editor";
import TableEditor from "@/components/brain/blocks/editors/table-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BrainBlock, BrainBlockPatch } from "@/lib/brain/client";

/**
 * One section, open.
 *
 * The digest field sits above the contents rather than below, because it is the
 * part that is always in the prompt and the contents usually are not. A creator
 * scanning this should read it in the order the model does.
 */
export default function BlockEditor({
  block,
  onEdit,
}: {
  block: BrainBlock;
  onEdit: (patch: BrainBlockPatch) => void;
}) {
  return (
    <div className="space-y-4 px-4 pt-1 pb-4">
      <div className="space-y-1.5">
        <Label htmlFor={`digest-${block.id}`} className="sg-field-label">
          What this is, in one line
        </Label>
        <Input
          id={`digest-${block.id}`}
          value={block.digest}
          placeholder="Search terms with thin answers, use when picking a topic"
          onChange={(event) => onEdit({ digest: event.target.value })}
          className="max-w-[68ch]"
        />
        <p className="text-muted-foreground text-xs">
          The only part of this section that is in every prompt. Say when it
          matters, not just what it is.
        </p>
      </div>

      {block.kind === "list" ? (
        <ListEditor
          items={block.items}
          placeholder="Add a line"
          onChange={(items) => onEdit({ items })}
        />
      ) : block.kind === "table" ? (
        <TableEditor
          table={block.rows ?? { columns: [], rows: [] }}
          onChange={(rows) => onEdit({ rows })}
        />
      ) : block.kind === "doc" ? (
        <DocEditor
          title={block.title}
          body={block.body}
          onChange={(body) => onEdit({ body })}
        />
      ) : (
        <NoteEditor
          title={block.title}
          body={block.body}
          onChange={(body) => onEdit({ body })}
        />
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor={`tags-${block.id}`} className="sg-field-label">
            Tags
          </Label>
          <Input
            id={`tags-${block.id}`}
            defaultValue={block.tags.join(", ")}
            placeholder="pricing, objections"
            onBlur={(event) =>
              onEdit({
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim().toLowerCase())
                  .filter(Boolean)
                  .slice(0, 8),
              })
            }
          />
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor={`source-${block.id}`} className="sg-field-label">
            Where it came from
          </Label>
          <Input
            id={`source-${block.id}`}
            value={block.sourceLabel}
            placeholder="TikTok Creator Search Insights"
            onChange={(event) => onEdit({ sourceLabel: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
