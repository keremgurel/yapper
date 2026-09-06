"use client";

import ItemPillarField from "@/components/library/item-pillar-field";
import FormatField from "@/components/workbench/format-field";
import { Input } from "@/components/ui/input";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";

/**
 * The few facts about the piece that are not its words, on one quiet line
 * under the title: pillar, what it publishes as, and the plan date when it
 * has one. No labels stacked above controls; each control names itself.
 */
export default function CanvasDetails({
  item,
  update,
}: {
  item: ContentDetail;
  update: (patch: ContentPatch) => void;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <ItemPillarField
        pillarId={item.pillarId}
        legacyName={item.pillar}
        onChange={(pillarId) => update({ pillarId })}
      />
      <FormatField
        formats={item.formats}
        onChange={(formats) => update({ formats })}
      />
      {item.status === "ready" && (
        <Input
          type="datetime-local"
          value={toLocalInput(item.scheduledFor)}
          onChange={(event) => {
            const iso = fromLocalInput(event.target.value);
            if (iso) update({ scheduledFor: iso });
          }}
          className="h-8 w-auto text-xs"
          aria-label="Scheduled for"
        />
      )}
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
