"use client";

import PillarEditor from "@/components/project/pillar-editor";
import ProjectField from "@/components/project/project-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SaveState } from "@/hooks/use-autosave";
import type { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS, type ProjectPatch } from "@/lib/project/client";

function saveLabel(state: SaveState): string | null {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved";
  if (state === "error") return "Save failed. Edits retry on your next change.";
  return null;
}

/** The Essentials, edited in place on one card. Two columns on wide screens
 * so the fields read as a form, not a scroll. Autosaves on every change. */
export default function EssentialsFields({
  project,
  pillars,
  saveState,
  onUpdate,
}: {
  project: NonNullable<ReturnType<typeof useProject>["project"]>;
  pillars: ReturnType<typeof useProject>["pillars"];
  saveState: SaveState;
  onUpdate: (patch: ProjectPatch) => void;
}) {
  const saved = saveLabel(saveState);
  return (
    <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-[17px] font-semibold tracking-[-0.01em]">
            About you
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Read before anything is written for you. Plain sentences are fine.
          </p>
        </div>
        {saved ? (
          <span
            className={`text-xs ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}
            role={saveState === "error" ? "alert" : undefined}
          >
            {saved}
          </span>
        ) : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-1.5 lg:col-span-2">
          <Label
            htmlFor="brain-project-name"
            className="text-foreground text-[13px] font-medium"
          >
            What you call this
          </Label>
          <Input
            id="brain-project-name"
            name="brain-project-name"
            value={project.name}
            placeholder="My channel"
            autoComplete="off"
            className="max-w-sm text-[15px]"
            onChange={(event) => onUpdate({ name: event.target.value })}
          />
        </div>
        {PROJECT_FIELDS.map((field) => (
          <ProjectField
            key={field.key}
            id={`brain-essential-${field.key}`}
            label={field.label}
            placeholder={field.placeholder}
            rows={field.rows}
            value={project[field.key]}
            onChange={(value) => onUpdate({ [field.key]: value })}
          />
        ))}
        <div className="lg:col-span-2">
          <Label className="text-foreground text-[13px] font-medium">
            Pillars
          </Label>
          <p className="text-muted-foreground mt-0.5 mb-2 text-sm">
            The angles you actually make. Every idea is filed under one.
          </p>
          <PillarEditor
            pillars={pillars}
            onChange={(next) => onUpdate({ pillars: next })}
          />
        </div>
      </div>
    </section>
  );
}
