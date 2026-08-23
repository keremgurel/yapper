"use client";

import { Loader2 } from "lucide-react";
import PillarEditor from "@/components/project/pillar-editor";
import ProjectField from "@/components/project/project-field";
import { Section } from "@/components/studio-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS } from "@/lib/project/client";

/**
 * The part of the brain every creator has: what they make, who it is for, how
 * they sound, and their pillars.
 *
 * These are the fields that are read on every single call, which is why they
 * are fixed while everything below them is not. The questions here are the ones
 * every creator has an answer to; the sections underneath are the ones only
 * this creator has.
 */
export default function IdentitySection({
  onChanged,
}: {
  onChanged: () => void;
}) {
  const { project, pillars, loading, saveState, update } = useProject(true);

  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your brain…
      </p>
    );
  }

  if (!project) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Your brain could not be loaded. Reload the page and it will try again.
      </p>
    );
  }

  const change = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    onChanged();
  };

  return (
    <Section
      title="You"
      action={
        saveState !== "idle" ? (
          <span
            className={`text-xs ${
              saveState === "error"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
            role={saveState === "error" ? "alert" : undefined}
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "saved"
                ? "Saved"
                : "Save failed. Edits retry on your next change."}
          </span>
        ) : undefined
      }
    >
      <div className="max-w-[68ch] space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="brain-name" className="sg-field-label">
            What you call this
          </Label>
          <Input
            id="brain-name"
            value={project.name}
            placeholder="My channel"
            onChange={(event) => change({ name: event.target.value })}
          />
        </div>

        {PROJECT_FIELDS.map((field) => (
          <ProjectField
            key={field.key}
            id={`brain-${field.key}`}
            label={field.label}
            placeholder={field.placeholder}
            rows={field.rows}
            value={project[field.key]}
            onChange={(value) => change({ [field.key]: value })}
          />
        ))}

        <div className="space-y-1.5">
          <Label className="sg-field-label">Pillars</Label>
          <PillarEditor
            pillars={pillars}
            onChange={(next) => change({ pillars: next })}
          />
        </div>
      </div>
    </Section>
  );
}
