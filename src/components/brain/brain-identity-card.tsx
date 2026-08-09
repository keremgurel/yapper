"use client";

import { Loader2 } from "lucide-react";
import PillarEditor from "@/components/project/pillar-editor";
import ProjectField from "@/components/project/project-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS } from "@/lib/project/client";

/**
 * The part of the brain every creator has: what they make, who it is for, how
 * they sound, and their pillars.
 *
 * The same fields the header sheet has always saved, on the page now rather
 * than behind a drawer, because a brain you have to remember to open is one
 * that stays half-filled. Autosaved through the one project queue, so the sheet
 * and the page can never disagree.
 */
export default function BrainIdentityCard() {
  const { project, pillars, loading, saveState, update } = useProject(true);

  if (loading) {
    return (
      <section className="sg-card text-muted-foreground flex items-center gap-2 p-5 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your brain…
      </section>
    );
  }

  if (!project) {
    return (
      <section className="sg-card p-5">
        <p className="text-destructive text-sm" role="alert">
          Your brain could not be loaded. Reload the page and it will try again.
        </p>
      </section>
    );
  }

  return (
    <section className="sg-card space-y-5 p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold tracking-wide uppercase">You</h2>
        {saveState !== "idle" && (
          <span
            className={`text-xs font-semibold ${
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
        )}
      </header>

      <div className="space-y-2">
        <Label htmlFor="brain-name" className="sg-field-label">
          What you call this
        </Label>
        <Input
          id="brain-name"
          value={project.name}
          placeholder="My channel"
          onChange={(event) => update({ name: event.target.value })}
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
          onChange={(value) => update({ [field.key]: value })}
        />
      ))}

      <div className="space-y-2">
        <Label className="sg-field-label">Pillars</Label>
        <PillarEditor
          pillars={pillars}
          onChange={(next) => update({ pillars: next })}
        />
      </div>
    </section>
  );
}
