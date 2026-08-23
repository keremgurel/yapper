"use client";

import { Chip } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brainSurfaces } from "@/lib/db/schema";
import type {
  AdminCatalogEntry,
  AdminCatalogPatch,
} from "@/lib/admin/catalog-client";

/**
 * One catalog entry, open for editing.
 *
 * Deliberately plain. This is a shelf-stocking tool for a handful of people,
 * and every hour spent designing it is an hour not spent on the surface
 * creators actually use.
 */
export default function CatalogEntryForm({
  entry,
  onChange,
  onDelete,
}: {
  entry: AdminCatalogEntry;
  onChange: (patch: AdminCatalogPatch) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 px-4 pb-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name-${entry.id}`} className="sg-field-label">
            Name
          </Label>
          <Input
            id={`name-${entry.id}`}
            defaultValue={entry.name}
            onBlur={(event) => onChange({ name: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`category-${entry.id}`} className="sg-field-label">
            Category
          </Label>
          <Input
            id={`category-${entry.id}`}
            defaultValue={entry.category}
            placeholder="Hooks"
            onBlur={(event) => onChange({ category: event.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`tagline-${entry.id}`} className="sg-field-label">
          Tagline
        </Label>
        <Input
          id={`tagline-${entry.id}`}
          defaultValue={entry.tagline}
          onBlur={(event) => onChange({ tagline: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`when-${entry.id}`} className="sg-field-label">
          When to use
        </Label>
        <Input
          id={`when-${entry.id}`}
          defaultValue={entry.whenToUse}
          onBlur={(event) => onChange({ whenToUse: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <span className="sg-field-label">Surfaces</span>
        <div className="flex flex-wrap gap-1.5">
          {brainSurfaces.map((surface) => (
            <button
              key={surface}
              type="button"
              aria-pressed={entry.surfaces.includes(surface)}
              onClick={() =>
                onChange({
                  surfaces: entry.surfaces.includes(surface)
                    ? entry.surfaces.filter((value) => value !== surface)
                    : [...entry.surfaces, surface],
                })
              }
            >
              <Chip
                tone={entry.surfaces.includes(surface) ? "cyan" : "neutral"}
              >
                {surface}
              </Chip>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`instructions-${entry.id}`} className="sg-field-label">
          Instructions
        </Label>
        <Textarea
          id={`instructions-${entry.id}`}
          defaultValue={entry.instructions}
          rows={16}
          onBlur={(event) => onChange({ instructions: event.target.value })}
          className="font-mono text-[13px] leading-relaxed"
        />
        <p className="text-muted-foreground text-xs">
          Editing this bumps the version, which offers the update to every brain
          already running a copy.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={entry.published}
            onChange={(event) => onChange({ published: event.target.checked })}
            className="h-3.5 w-3.5 accent-[color:var(--sg-accent)]"
          />
          Published
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
