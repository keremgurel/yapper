"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import CopyScriptButton from "@/components/library/copy-script-button";
import ItemPillarField from "@/components/library/item-pillar-field";
import StatusSelect from "@/components/library/status-select";
import SaveIndicator from "@/components/workbench/save-indicator";
import FormatField from "@/components/workbench/format-field";
import SourceCard from "@/components/workbench/source-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultScheduleDate } from "@/lib/content/client";
import { hookTexts } from "@/lib/content/normalize";
import { scriptMeter } from "@/lib/content/script-meter";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";
import type { SaveState } from "@/hooks/use-autosave";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Everything about the shoot that is not the words themselves.
 *
 * This is the half of the workbench that used to sit at the bottom of a very
 * long page, which meant the two things the library is organised by — pillar
 * and status — were invisible while you worked. They are the first thing here.
 *
 * Sticky, because Record is the point of the screen and should never be
 * somewhere you have to scroll to find.
 */
export default function ShootRail({
  item,
  saveState,
  update,
  onDelete,
}: {
  item: ContentDetail;
  saveState: SaveState;
  update: (patch: ContentPatch) => void;
  onDelete: () => void;
}) {
  const meter = scriptMeter(item.script);

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="border-border bg-card space-y-4 rounded-xl border p-4">
        <Field label="Status">
          <StatusSelect
            value={item.status}
            onChange={(status: ContentStatus) =>
              update(
                status === "scheduled" && !item.scheduledFor
                  ? { status, scheduledFor: defaultScheduleDate() }
                  : { status },
              )
            }
          />
        </Field>

        {item.status === "scheduled" && (
          <Field label="Goes out">
            <Input
              type="datetime-local"
              value={toLocalInput(item.scheduledFor)}
              onChange={(e) => {
                const iso = fromLocalInput(e.target.value);
                if (iso) update({ scheduledFor: iso });
              }}
              className="h-9 w-full"
              aria-label="Scheduled for"
            />
          </Field>
        )}

        <Field label="Pillar">
          <ItemPillarField
            pillarId={item.pillarId}
            legacyName={item.pillar}
            onChange={(pillarId) => update({ pillarId })}
          />
        </Field>

        <Field label="Publishing as">
          <FormatField
            formats={item.formats}
            onChange={(formats) => update({ formats })}
          />
        </Field>

        {item.format && (
          <Field label="Source format">
            <p className="text-muted-foreground text-xs font-semibold">
              {item.format}
            </p>
          </Field>
        )}

        <SourceCard
          title={item.sourceTitle}
          url={item.sourceUrl}
          transcript={item.sourceTranscript}
          summary={item.sourceSummary}
          status={item.transcriptStatus}
          update={update}
        />

        {/* The number that decides whether this fits the format, next to the
            button that starts the take. */}
        <div className="border-border flex items-center justify-between border-t pt-3">
          <span className="text-muted-foreground text-xs font-semibold">
            {meter.words
              ? `~${meter.label} · ${meter.words} words`
              : "No script yet"}
          </span>
          <SaveIndicator state={saveState} />
        </div>

        <div className="space-y-2">
          <Button asChild className="w-full">
            <Link href={`/studio/recorder?item=${item.id}`}>
              <Video className="h-4 w-4" />
              Record
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <CopyScriptButton
              idea={{ ...item, hooks: hookTexts(item.hooks) }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </aside>
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
