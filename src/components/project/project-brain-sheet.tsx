"use client";

import { Loader2 } from "lucide-react";
import PillarEditor from "@/components/project/pillar-editor";
import ProjectField from "@/components/project/project-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS } from "@/lib/project/client";
import type { SaveState } from "@/hooks/use-autosave";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className={`text-xs font-semibold ${
        state === "error" ? "text-destructive" : "text-muted-foreground"
      }`}
      role={state === "error" ? "alert" : undefined}
    >
      {state === "saving"
        ? "Saving…"
        : state === "saved"
          ? "Saved"
          : "Save failed. Edits retry on your next change."}
    </span>
  );
}

/**
 * The project brain: the standing context every AI call in Studio reads. Opened
 * from the Studio header, so it is reachable from Idea Bank, the Content
 * Library, and the workbench without navigating away from the work.
 *
 * Everything autosaves. There is no save button, because a half-filled brain is
 * strictly better than an abandoned form.
 */
export default function ProjectBrainSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Fetch only once the sheet has actually been opened; the header renders on
  // every Studio page and must not cost a request on each of them.
  const { project, pillars, loading, saveState, update } = useProject(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle>Project brain</SheetTitle>
            <SaveIndicator state={saveState} />
          </div>
          <SheetDescription>
            What you make, who it&apos;s for, and how you sound. Every AI
            suggestion in Studio reads this first.
          </SheetDescription>
        </SheetHeader>

        {loading && !project ? (
          <div className="text-muted-foreground flex items-center gap-2 px-4 py-12 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : !project ? (
          <p className="text-muted-foreground px-4 py-12 text-sm">
            Couldn&apos;t load your project. Close this and reopen to retry.
          </p>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            <div className="space-y-2">
              <Label htmlFor="project-name" className="sg-field-label">
                Account name
              </Label>
              <Input
                id="project-name"
                value={project.name}
                placeholder="CELPIP Speaking"
                onChange={(e) => update({ name: e.target.value })}
              />
            </div>

            {PROJECT_FIELDS.map((field) => (
              <ProjectField
                key={field.key}
                id={`project-${field.key}`}
                label={field.label}
                placeholder={field.placeholder}
                rows={field.rows}
                value={project[field.key]}
                onChange={(value) => update({ [field.key]: value })}
              />
            ))}

            <PillarEditor
              pillars={pillars}
              onChange={(next) => update({ pillars: next })}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
