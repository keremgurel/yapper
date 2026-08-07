"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { PillarDraft } from "@/lib/project/client";

/**
 * One editable pillar: name always visible, description and example angles
 * behind a disclosure so a long list stays scannable. Render-only.
 */
export default function PillarRow({
  pillar,
  index,
  open,
  onToggle,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  pillar: PillarDraft;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<PillarDraft>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const describedBy = `pillar-${index}-detail`;

  return (
    <div className="border-border bg-card rounded-lg border">
      <div className="flex items-center gap-1.5 p-2">
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            aria-label={`Move ${pillar.name || "pillar"} up`}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            aria-label={`Move ${pillar.name || "pillar"} down`}
            className="text-muted-foreground hover:text-foreground disabled:opacity-25"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <Input
          value={pillar.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Pillar name"
          aria-label={`Pillar ${index + 1} name`}
          className="h-9 border-0 bg-transparent font-semibold shadow-none focus-visible:ring-0"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={describedBy}
          aria-label={open ? "Hide pillar detail" : "Show pillar detail"}
          className="text-muted-foreground"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Delete ${pillar.name || "pillar"}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div id={describedBy} className="space-y-2.5 border-t px-3 py-3">
          <Textarea
            value={pillar.description}
            rows={2}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="What belongs in this pillar, and what does not."
            aria-label={`${pillar.name || "Pillar"} description`}
          />
          <Textarea
            value={pillar.examples.join("\n")}
            rows={2}
            onChange={(e) =>
              onChange({
                examples: e.target.value.split("\n").map((l) => l.trimStart()),
              })
            }
            placeholder={"One example angle per line\nTask 5 in 60 seconds"}
            aria-label={`${pillar.name || "Pillar"} example angles`}
          />
          <p className="text-muted-foreground text-xs">
            One example angle per line. These teach the AI the shape of the
            pillar, not just its name.
          </p>
        </div>
      )}
    </div>
  );
}
