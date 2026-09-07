"use client";

import PillarEditor from "@/components/project/pillar-editor";
import ProjectField from "@/components/project/project-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SaveState } from "@/hooks/use-autosave";
import type { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS, type ProjectPatch } from "@/lib/project/client";

/** The Essentials, edited in place. Autosaves on every change. */
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
  return (
    <section className="border-border bg-card rounded-2xl border p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Essentials</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Read on every call. Written from your videos, then yours to edit.
          </p>
        </div>
        {saveState !== "idle" ? (
          <span
            className={`text-xs ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}
            role={saveState === "error" ? "alert" : undefined}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : "Save failed. Edits retry on your next change."}
          </span>
        ) : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="brain-project-name" className="sg-field-label">
            What you call this
          </Label>
          <Input
            id="brain-project-name"
            name="brain-project-name"
            value={project.name}
            placeholder="My channel"
            autoComplete="off"
            className="max-w-md"
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
          <Label className="sg-field-label">Pillars</Label>
          <div className="mt-1.5">
            <PillarEditor
              pillars={pillars}
              onChange={(next) => onUpdate({ pillars: next })}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
