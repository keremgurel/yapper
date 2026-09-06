"use client";

import PillarEditor from "@/components/project/pillar-editor";
import ProjectField from "@/components/project/project-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SaveState } from "@/hooks/use-autosave";
import type { useProject } from "@/hooks/use-project";
import { PROJECT_FIELDS, type ProjectPatch } from "@/lib/project/client";

function SaveNote({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span
      className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}
      role={state === "error" ? "alert" : undefined}
    >
      {state === "saving"
        ? "Saving…"
        : state === "saved"
          ? "Saved"
          : "Save failed. Your next edit retries it."}
    </span>
  );
}

/** The Essentials, editable: name, the four identity fields, and pillars. */
export default function EssentialsSheet({
  open,
  onOpenChange,
  project,
  pillars,
  saveState,
  onUpdate,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ReturnType<typeof useProject>["project"];
  pillars: ReturnType<typeof useProject>["pillars"];
  saveState: SaveState;
  onUpdate: (patch: ProjectPatch) => void;
  onRetry: () => Promise<unknown>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle>Essentials</SheetTitle>
            <SaveNote state={saveState} />
          </div>
          <SheetDescription>
            What Yapper reads every time it writes with you.
          </SheetDescription>
        </SheetHeader>

        {saveState === "error" ? (
          <div role="alert" className="text-destructive px-4 pb-4 text-sm">
            Your changes are still here but couldn’t be saved.
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => void onRetry().catch(() => {})}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {project ? (
          <div className="space-y-6 px-4 pb-8">
            <div className="space-y-1.5">
              <Label htmlFor="brain-project-name" className="sg-field-label">
                What you call this
              </Label>
              <Input
                id="brain-project-name"
                name="brain-project-name"
                value={project.name}
                placeholder="My channel…"
                autoComplete="off"
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

            <PillarEditor
              pillars={pillars}
              onChange={(next) => onUpdate({ pillars: next })}
            />
          </div>
        ) : (
          <div className="text-muted-foreground px-4 py-10 text-sm">
            <p>Your Essentials could not be loaded.</p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => void onRetry().catch(() => {})}
            >
              Try again
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
