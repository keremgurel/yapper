"use client";

import Link from "next/link";
import { Send, Video } from "lucide-react";
import CopyScriptButton from "@/components/library/copy-script-button";
import ItemPillarField from "@/components/library/item-pillar-field";
import StatusSelect from "@/components/library/status-select";
import FormatField from "@/components/workbench/format-field";
import RailRow from "@/components/workbench/rail-row";
import SaveIndicator from "@/components/workbench/save-indicator";
import SendToPhone from "@/components/workbench/send-to-phone";
import SourceCard from "@/components/workbench/source-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultScheduleDate } from "@/lib/content/client";
import { hookTexts } from "@/lib/content/normalize";
import { scriptMeter } from "@/lib/content/script-meter";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";
import type { SaveState } from "@/hooks/use-autosave";

/**
 * Everything about the shoot that is not the words themselves.
 *
 * Status and pillar lead, because those are the two axes the library organises
 * by and they used to be invisible while you worked. Then the reference, then
 * the read time and Record, which is the point of the screen.
 *
 * One card with dividers rather than four separately labelled blocks. The rail
 * is a summary you glance at, and stacking an uppercase label above every
 * control turned it into a form to fill in.
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
  const hasSource = Boolean(item.sourceTitle || item.sourceUrl || item.format);

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="border-border/70 bg-card divide-border/60 divide-y rounded-xl border">
        <div className="space-y-3 p-4">
          <RailRow label="Status">
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
          </RailRow>

          {item.status === "scheduled" && (
            <RailRow label="Goes out">
              <Input
                type="datetime-local"
                value={toLocalInput(item.scheduledFor)}
                onChange={(e) => {
                  const iso = fromLocalInput(e.target.value);
                  if (iso) update({ scheduledFor: iso });
                }}
                className="h-8 w-auto text-xs"
                aria-label="Scheduled for"
              />
            </RailRow>
          )}

          <RailRow label="Pillar">
            <ItemPillarField
              pillarId={item.pillarId}
              legacyName={item.pillar}
              onChange={(pillarId) => update({ pillarId })}
            />
          </RailRow>

          <RailRow label="Publishing as" align="start">
            <FormatField
              formats={item.formats}
              onChange={(formats) => update({ formats })}
            />
          </RailRow>
        </div>

        {hasSource && (
          <div className="space-y-2 p-4">
            <SourceCard
              title={item.sourceTitle}
              url={item.sourceUrl}
              transcript={item.sourceTranscript}
              summary={item.sourceSummary}
              status={item.transcriptStatus}
              update={update}
            />
            {item.format && (
              <p className="text-muted-foreground/80 text-[11px] leading-snug">
                {item.format}
              </p>
            )}
          </div>
        )}

        <div className="p-4">
          {/* The number that decides whether this fits the format, right next
              to the button that starts the take. */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-bold">
              {meter.words
                ? `~${meter.label} · ${meter.words} words`
                : "No script yet"}
            </span>
            <SaveIndicator state={saveState} />
          </div>

          <Button asChild className="w-full">
            <Link href={`/studio/recorder?item=${item.id}`}>
              <Video className="h-4 w-4" />
              {item.submissionId ? "Record another take" : "Record"}
            </Link>
          </Button>

          {/* Once there is a take behind this item there is somewhere to send
              it, and making the creator go and find it again in the Poster grid
              is the friction this removes. */}
          {item.submissionId && (
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href={`/studio/poster?item=${item.id}`}>
                <Send className="h-4 w-4" />
                Cross-post this
              </Link>
            </Button>
          )}
          <div className="mt-2">
            <SendToPhone itemId={item.id} />
          </div>
          <div className="mt-2 flex items-center justify-between">
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
