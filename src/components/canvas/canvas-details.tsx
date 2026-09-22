"use client";

import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
import ItemPillarField from "@/components/library/item-pillar-field";
import FormatField from "@/components/workbench/format-field";
import { Input } from "@/components/ui/input";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";

/** The facts about the piece that are not its words: pillar, what it ships
 * as, and the plan date once it is ready. */
export default function CanvasDetails({
  item,
  update,
}: {
  item: ContentDetail;
  update: (patch: ContentPatch) => void;
}) {
  return (
    <section>
      <CanvasSectionTitle title="Details" />
      <dl className="space-y-4">
        <Row label="Pillar">
          <ItemPillarField
            pillarId={item.pillarId}
            legacyName={item.pillar}
            onChange={(pillarId) => update({ pillarId })}
          />
        </Row>
        <Row label="Ships as">
          <FormatField
            formats={item.formats}
            onChange={(formats) => update({ formats })}
          />
        </Row>
        {item.status === "ready" && (
          <Row label="Scheduled">
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
          </Row>
        )}
      </dl>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground mb-1.5 text-[12px] font-medium">
        {label}
      </dt>
      <dd className="m-0">{children}</dd>
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
