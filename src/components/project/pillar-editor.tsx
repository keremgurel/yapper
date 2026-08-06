"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import PillarRow from "@/components/project/pillar-row";
import { Button } from "@/components/ui/button";
import type { PillarDraft } from "@/lib/project/client";

/** Move an item within a list, returning a new array. Out-of-range moves are a
 * no-op so the caller does not have to guard the list edges twice. */
function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * The pillar list: add, rename, describe, reorder, delete. Owns only which rows
 * are expanded; the list itself lives with the parent so every change goes
 * through the one autosave queue.
 */
export default function PillarEditor({
  pillars,
  onChange,
}: {
  pillars: PillarDraft[];
  onChange: (pillars: PillarDraft[]) => void;
}) {
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const add = () => {
    onChange([...pillars, { name: "", description: "", examples: [] }]);
    // Open the row we just appended so its detail fields are reachable without
    // a second click.
    setOpenRows((prev) => new Set(prev).add(pillars.length));
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="sg-field-label">Content pillars</p>
        <p className="text-muted-foreground mt-1 text-xs">
          The angles you actually make. Every idea gets classified into one, and
          the AI writes to the pillar&apos;s description.
        </p>
      </div>

      {pillars.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-3 py-6 text-center text-sm">
          No pillars yet. Add the handful of angles you post about.
        </p>
      ) : (
        <div className="space-y-2">
          {pillars.map((pillar, index) => (
            <PillarRow
              key={pillar.id ?? `new-${index}`}
              pillar={pillar}
              index={index}
              open={openRows.has(index)}
              onToggle={() => toggleRow(index)}
              onChange={(patch) =>
                onChange(
                  pillars.map((p, i) => (i === index ? { ...p, ...patch } : p)),
                )
              }
              onRemove={() => {
                onChange(pillars.filter((_, i) => i !== index));
                setOpenRows(new Set());
              }}
              onMove={(direction) => {
                onChange(moved(pillars, index, index + direction));
                setOpenRows(new Set());
              }}
              canMoveUp={index > 0}
              canMoveDown={index < pillars.length - 1}
            />
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" />
        Add pillar
      </Button>
    </div>
  );
}
