"use client";

import ProjectField from "@/components/project/project-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS, type ProjectPatch } from "@/lib/project/client";

/**
 * The Essentials as one column the creator reads top to bottom and fills in.
 * No card, no grid: each field is a question with room to answer it.
 */
export default function EssentialsFields({
  project,
  onUpdate,
}: {
  project: NonNullable<ReturnType<typeof useProject>["project"]>;
  onUpdate: (patch: ProjectPatch) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
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
    </div>
  );
}
