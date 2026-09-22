"use client";

import { Loader2 } from "lucide-react";
import EssentialsFields from "@/components/brain/essentials/essentials-fields";
import PillarEditor from "@/components/project/pillar-editor";
import { Section } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import type { SaveState } from "@/hooks/use-autosave";
import type { useProject } from "@/hooks/use-project";
import type { ProjectPatch } from "@/lib/project/client";

function saveLabel(state: SaveState): string | null {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved";
  if (state === "error") return "Save failed. Edits retry on your next change.";
  return null;
}

/** The two sections Yapper reads on every call: who you are, and your pillars. */
export default function EssentialsView({
  project,
  pillars,
  loading,
  saveState,
  onUpdate,
  onRetry,
}: {
  project: ReturnType<typeof useProject>["project"];
  pillars: ReturnType<typeof useProject>["pillars"];
  loading: boolean;
  saveState: SaveState;
  onUpdate: (patch: ProjectPatch) => void;
  onRetry: () => Promise<unknown>;
}) {
  const saved = saveLabel(saveState);
  if (loading) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading your Essentials…
      </p>
    );
  }
  if (!project) {
    return (
      <div className="text-muted-foreground text-sm">
        <p>Your Essentials could not be loaded.</p>
        <Button
          variant="outline"
          className="mt-3"
          onClick={() => void onRetry().catch(() => {})}
        >
          Try again
        </Button>
      </div>
    );
  }
  return (
    <>
      <Section
        title="About you"
        meta={
          saved && (
            <span
              className={saveState === "error" ? "text-destructive" : undefined}
              role={saveState === "error" ? "alert" : undefined}
            >
              {saved}
            </span>
          )
        }
      >
        <p className="text-muted-foreground mb-5 max-w-[60ch] text-sm">
          Read before anything is written for you. Plain sentences are fine.
        </p>
        <EssentialsFields project={project} onUpdate={onUpdate} />
      </Section>
      <Section title="Pillars" meta={`${pillars.length}`}>
        <p className="text-muted-foreground mb-4 max-w-[60ch] text-sm">
          The angles you actually make. Every idea is filed under one, and
          scripts are written to its description.
        </p>
        <PillarEditor
          pillars={pillars}
          onChange={(next) => onUpdate({ pillars: next })}
        />
      </Section>
    </>
  );
}
