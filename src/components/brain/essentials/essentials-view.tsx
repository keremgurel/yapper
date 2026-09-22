"use client";

import { FileText, Loader2 } from "lucide-react";
import EssentialsFields from "@/components/brain/essentials/essentials-fields";
import WhatYapperReads from "@/components/brain/essentials/what-yapper-reads";
import VoiceSection from "@/components/brain/voice/voice-section";
import { Button } from "@/components/ui/button";
import type { SaveState } from "@/hooks/use-autosave";
import type { useProject } from "@/hooks/use-project";
import type { ProjectPatch } from "@/lib/project/client";

/**
 * The Essentials tab: the voice, learned from the creator's own videos, and
 * the fields it writes into, edited in place.
 */
export default function EssentialsView({
  project,
  pillars,
  loading,
  saveState,
  onUpdate,
  onRetry,
  onRefresh,
  onSetUp,
  version,
}: {
  project: ReturnType<typeof useProject>["project"];
  pillars: ReturnType<typeof useProject>["pillars"];
  loading: boolean;
  saveState: SaveState;
  onUpdate: (patch: ProjectPatch) => void;
  onRetry: () => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
  /** Opens the sheet that fills the Brain from one pasted document. */
  onSetUp: () => void;
  /** Bumps whenever the brain changes, so the preview refetches. */
  version: number;
}) {
  return (
    <div className="space-y-6">
      <VoiceSection onProfileChanged={onRefresh} />
      <div className="bg-card border-border flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">
            Already wrote your content system down?
          </p>
          <p className="text-muted-foreground text-[13px]">
            Drop the document in and it fills every field below, your pillars,
            and the Knowledge worth keeping. You review each part first.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onSetUp}>
          <FileText className="size-4" aria-hidden="true" />
          Set up from a document
        </Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading your Essentials…
        </p>
      ) : project ? (
        <EssentialsFields
          project={project}
          pillars={pillars}
          saveState={saveState}
          onUpdate={onUpdate}
        />
      ) : (
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
      )}
      <WhatYapperReads version={version} />
    </div>
  );
}
