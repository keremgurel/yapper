"use client";

import ItemPillarField from "@/components/library/item-pillar-field";
import StatusSelect from "@/components/library/status-select";
import SaveIndicator from "@/components/workbench/save-indicator";
import { Input } from "@/components/ui/input";
import { defaultScheduleDate } from "@/lib/content/client";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";
import type { SaveState } from "@/hooks/use-autosave";

/** Where the item sits in the pipeline: stage, pillar, and when it goes out.
 * Below the creative work, because it is what you set once the idea is right. */
export default function PipelineBar({
  item,
  saveState,
  update,
}: {
  item: ContentDetail;
  saveState: SaveState;
  update: (patch: ContentPatch) => void;
}) {
  return (
    <div className="border-border flex flex-wrap items-center gap-3 border-t pt-4">
      <StatusSelect
        value={item.status}
        onChange={(status: ContentStatus) =>
          update(
            // Scheduling with no date would fail the DB check, so a date is
            // supplied with the status rather than rejected after the fact.
            status === "scheduled" && !item.scheduledFor
              ? { status, scheduledFor: defaultScheduleDate() }
              : { status },
          )
        }
      />
      <ItemPillarField
        pillarId={item.pillarId}
        legacyName={item.pillar}
        onChange={(pillarId) => update({ pillarId })}
      />
      {item.status === "scheduled" && (
        <Input
          type="datetime-local"
          value={toLocalInput(item.scheduledFor)}
          onChange={(e) => {
            const iso = fromLocalInput(e.target.value);
            if (iso) update({ scheduledFor: iso });
          }}
          className="h-9 w-auto"
          aria-label="Scheduled for"
        />
      )}
      <SaveIndicator state={saveState} />
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
