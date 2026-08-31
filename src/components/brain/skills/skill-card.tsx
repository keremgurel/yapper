"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Chip } from "@/components/studio-ui";
import { isStarterSkill } from "@/lib/brain/default-skills";
import type { BrainSkill } from "@/lib/brain/skills-client";

/**
 * One skill the creator has.
 *
 * The switch is the primary control, not the edit button. Most of the life of a
 * skill is being turned on for a season and off again, and that has to be one
 * click from the page rather than three clicks into a sheet.
 */
export default function SkillCard({
  skill,
  onToggle,
  onOpen,
  onRemove,
}: {
  skill: BrainSkill;
  onToggle: (enabled: boolean) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const starter = isStarterSkill(skill.catalogSlug);

  return (
    <div
      className={`border-border group rounded-xl border p-3 transition-opacity ${
        skill.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-2">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={skill.enabled}
            onChange={(event) => onToggle(event.target.checked)}
            aria-label={`${skill.enabled ? "Turn off" : "Turn on"} ${skill.name}`}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[color:var(--sg-accent)]"
          />
          <span className="min-w-0">
            <span className="text-foreground block truncate text-[13px] font-semibold">
              {skill.name}
            </span>
            {skill.whenToUse && (
              <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                {skill.whenToUse}
              </span>
            )}
          </span>
        </label>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={`Edit ${skill.name}`}
            onClick={onOpen}
            className="text-muted-foreground hover:text-foreground rounded p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!starter ? (
            <button
              type="button"
              aria-label={`Remove ${skill.name}`}
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive rounded p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {starter || skill.customized || skill.surfaces.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {starter ? <Chip tone="violet">Yapper default</Chip> : null}
          {skill.customized ? <Chip tone="cyan">Customized</Chip> : null}
          {skill.surfaces.map((surface) => (
            <Chip key={surface} tone="neutral">
              {surface}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
